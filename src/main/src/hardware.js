import { BrowserWindow } from 'electron';
import { randomUUID } from 'crypto';
import { setTimeout as delay } from 'timers/promises';

const PRINT_TIMEOUT_MS = 30000;
const HISTORY_LIMIT = 50;
const PAPER_WIDTHS = { '58mm': 58000, '80mm': 80000 };
const COPY_TYPES = new Set(['customer', 'merchant', 'kitchen']);

function now() {
  return new Date().toISOString();
}

function text(value, fallback = '') {
  return typeof value === 'string' ? value.slice(0, 500) : fallback;
}

function money(value, currency = 'LKR', locale = 'en-LK') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2 }).format(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function validatePrintPayload(raw = {}) {
  const copyType = COPY_TYPES.has(raw.copyType) ? raw.copyType : 'customer';
  const paper = raw.paper === '58mm' ? '58mm' : '80mm';
  const order = raw.order && typeof raw.order === 'object' ? raw.order : null;
  if (!order) throw new Error('order is required');
  return {
    id: text(raw.id, randomUUID()),
    copyType,
    paper,
    reprint: Boolean(raw.reprint),
    restaurant: raw.restaurant && typeof raw.restaurant === 'object' ? raw.restaurant : {},
    order
  };
}

function validatePrinterSettings(raw = {}) {
  return {
    stationKey: text(raw.stationKey, randomUUID()).slice(0, 128),
    stationName: text(raw.stationName, 'Cashier station').slice(0, 120),
    branchId: raw.branchId ? text(raw.branchId).slice(0, 128) : null,
    expectedBranchId: raw.expectedBranchId ? text(raw.expectedBranchId).slice(0, 128) : raw.branchId ? text(raw.branchId).slice(0, 128) : null,
    branchName: raw.branchName ? text(raw.branchName).slice(0, 160) : null,
    branchCode: raw.branchCode ? text(raw.branchCode).slice(0, 80) : null,
    reassignmentLocked: raw.reassignmentLocked !== undefined ? Boolean(raw.reassignmentLocked) : true,
    receiptPrinterName: raw.receiptPrinterName ? text(raw.receiptPrinterName).slice(0, 200) : null,
    kitchenPrinterName: raw.kitchenPrinterName ? text(raw.kitchenPrinterName).slice(0, 200) : null,
    cashDrawerPrinterName: raw.cashDrawerPrinterName ? text(raw.cashDrawerPrinterName).slice(0, 200) : null,
    defaultPaper: raw.defaultPaper === '58mm' ? '58mm' : '80mm',
    receiptLocale: raw.receiptLocale ? text(raw.receiptLocale).slice(0, 20) : 'en-LK',
    printerCodePage: raw.printerCodePage ? text(raw.printerCodePage).slice(0, 40) : 'utf-8',
    fiscalDeviceMode: raw.fiscalDeviceMode === 'external' ? 'external' : 'none',
    autoPrintReceipt: Boolean(raw.autoPrintReceipt),
    autoPrintKitchenTicket: Boolean(raw.autoPrintKitchenTicket),
    kitchenRoutes: raw.kitchenRoutes && typeof raw.kitchenRoutes === 'object' && !Array.isArray(raw.kitchenRoutes) ? raw.kitchenRoutes : {}
  };
}

function lineModifierText(item) {
  const snapshot = item.pricingSnapshot || {};
  const modifiers = Array.isArray(item.modifiers) ? item.modifiers : Array.isArray(snapshot.modifiers) ? snapshot.modifiers : [];
  const parts = [item.variantName || snapshot.variant?.name, ...modifiers.map((modifier) => modifier.optionName || modifier.name), item.notes].filter(Boolean);
  return parts.join(' / ');
}

function renderReceiptHtml(payload, settings) {
  const order = payload.order;
  const restaurant = payload.restaurant || {};
  const currency = restaurant.currency || 'LKR';
  const locale = settings.receiptLocale || restaurant.locale || 'en-LK';
  const breakdown = order.pricingBreakdown || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const title = payload.copyType === 'kitchen' ? 'Kitchen Ticket' : 'Receipt';
  const verification = order.id || order.orderNumber || payload.id;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;margin:0;color:#111;font-size:12px}.receipt{width:${payload.paper === '58mm' ? '54mm' : '76mm'};padding:10px}.center{text-align:center}.muted{color:#555}.row{display:flex;justify-content:space-between;gap:8px}.line{border-top:1px dashed #999;margin:8px 0}.item{margin:7px 0}.name{font-weight:700}.small{font-size:10px}.total{font-size:16px;font-weight:800}.copy{border:1px solid #111;padding:3px 6px;display:inline-block;margin:4px 0;text-transform:uppercase}.qr{font-family:monospace;word-break:break-all}
  </style></head><body><main class="receipt">
    <section class="center"><h2>${escapeHtml(restaurant.name || restaurant.businessName || 'Restaurant POS')}</h2><div class="muted">${escapeHtml(restaurant.address || '')}</div><div class="copy">${payload.reprint ? 'Reprint / ' : ''}${escapeHtml(payload.copyType)} ${escapeHtml(title)}</div></section>
    <div class="line"></div>
    <div class="row"><span>Order</span><strong>#${escapeHtml(order.orderNumber || '-')}</strong></div>
    <div class="row"><span>Receipt</span><span>${escapeHtml(payload.id)}</span></div>
    <div class="row"><span>Date</span><span>${escapeHtml(new Date(order.createdAt || Date.now()).toLocaleString(locale))}</span></div>
    <div class="row"><span>Channel</span><span>${escapeHtml(order.orderChannel || '')}</span></div>
    <div class="row"><span>Payment</span><span>${escapeHtml(order.paymentMethod || '')}</span></div>
    ${order.tableNumber ? `<div class="row"><span>Table</span><span>${escapeHtml(order.area || '')} ${escapeHtml(order.tableNumber)}</span></div>` : ''}
    ${order.customerName ? `<div class="row"><span>Customer</span><span>${escapeHtml(order.customerName)}</span></div>` : ''}
    <div class="line"></div>
    ${items.map((item) => `<div class="item"><div class="row"><span class="name">${escapeHtml(item.quantity)} x ${escapeHtml(item.menuItem?.name || item.name || 'Item')}</span><span>${escapeHtml(money((item.price || 0) * (item.quantity || 1), currency, locale))}</span></div>${lineModifierText(item) ? `<div class="small muted">${escapeHtml(lineModifierText(item))}</div>` : ''}</div>`).join('')}
    <div class="line"></div>
    <div class="row"><span>Subtotal</span><span>${escapeHtml(money(breakdown.subtotal ?? order.total, currency, locale))}</span></div>
    <div class="row"><span>Discounts</span><span>${escapeHtml(money(order.discountTotal || 0, currency, locale))}</span></div>
    <div class="row"><span>${escapeHtml(restaurant.taxLabel || 'Tax')}</span><span>${escapeHtml(money(order.taxTotal || 0, currency, locale))}</span></div>
    <div class="row"><span>Service</span><span>${escapeHtml(money(order.serviceChargeTotal || 0, currency, locale))}</span></div>
    <div class="line"></div>
    <div class="row total"><span>Total</span><span>${escapeHtml(money(order.total, currency, locale))}</span></div>
    <div class="line"></div>
    <div class="center small qr">Verify: ${escapeHtml(verification)}</div>
    <p class="center muted">${escapeHtml(restaurant.footer || settings.receiptFooter || 'Thank you.')}</p>
  </main></body></html>`;
}

export default class HardwareManager {
  constructor(mainWindow, preferences) {
    this.mainWindow = mainWindow;
    this.preferences = preferences;
    this.queue = Promise.resolve();
    this.history = [];
  }

  capabilities() {
    return {
      receiptPrinter: true,
      kitchenPrinter: true,
      cashDrawer: true,
      barcodeScanner: 'keyboard-wedge',
      customerDisplay: true,
      paymentTerminal: false,
      weighingScale: false,
      labelPrinter: false
    };
  }

  settings() {
    const saved = this.preferences.get('hardwareSettings') || {};
    const normalized = validatePrinterSettings(saved);
    if (!saved.stationKey) normalized.stationKey = randomUUID();
    return normalized;
  }

  async setSettings(raw) {
    const settings = validatePrinterSettings({ ...this.settings(), ...raw });
    await this.preferences.set('hardwareSettings', settings);
    return settings;
  }

  async printers() {
    const printers = await this.mainWindow.webContents.getPrintersAsync();
    return printers.map((printer) => ({
      name: printer.name,
      displayName: printer.displayName || printer.name,
      status: printer.status,
      isDefault: Boolean(printer.isDefault),
      options: printer.options || {}
    }));
  }

  async previewReceipt(raw) {
    const payload = validatePrintPayload(raw);
    return { html: renderReceiptHtml(payload, this.settings()) };
  }

  async printReceipt(raw) {
    const payload = validatePrintPayload(raw);
    return this.enqueue('receipt', payload, async () => this.printHtml(payload));
  }

  async testPrint(raw = {}) {
    const settings = this.settings();
    return this.printReceipt({
      copyType: raw.copyType || 'customer',
      paper: raw.paper || settings.defaultPaper,
      restaurant: { name: 'Restaurant POS', currency: 'LKR', footer: 'Printer test complete.' },
      order: {
        id: 'TEST-' + Date.now(),
        orderNumber: 'TEST',
        createdAt: now(),
        orderChannel: 'DINE_IN',
        paymentMethod: 'OTHER',
        total: 0,
        items: [{ id: 'test', quantity: 1, price: 0, menuItem: { name: 'Printer test line' } }]
      }
    });
  }

  async openCashDrawer(raw = {}) {
    const settings = this.settings();
    if (!settings.cashDrawerPrinterName && !settings.receiptPrinterName) throw new Error('No drawer-capable printer configured');
    const reason = text(raw.reason).trim();
    if (!reason) throw new Error('Drawer open reason is required');
    const job = await this.testPrint({ ...raw, copyType: 'merchant' });
    this.record({ ...job, kind: 'cash-drawer', reason, cashSessionId: text(raw.cashSessionId), staffProfileId: text(raw.staffProfileId), updatedAt: now() });
    return { ...job, reason, cashSessionId: text(raw.cashSessionId), staffProfileId: text(raw.staffProfileId) };
  }

  getHistory() {
    return this.history;
  }

  async enqueue(kind, payload, task) {
    const job = { id: payload.id || randomUUID(), kind, copyType: payload.copyType, status: 'queued', attempts: 0, createdAt: now(), updatedAt: now(), orderNumber: payload.order?.orderNumber };
    this.record(job);
    this.queue = this.queue.then(async () => {
      job.status = 'printing';
      job.attempts += 1;
      job.updatedAt = now();
      this.record(job);
      try {
        await Promise.race([task(), delay(PRINT_TIMEOUT_MS).then(() => { throw new Error('Print timed out'); })]);
        job.status = 'printed';
      } catch (error) {
        job.status = 'failed';
        job.error = error.message;
        throw error;
      } finally {
        job.updatedAt = now();
        this.record(job);
      }
    });
    try {
      await this.queue;
      return job;
    } catch (error) {
      return { ...job, success: false, error: error.message };
    }
  }

  async printHtml(payload) {
    const settings = this.settings();
    const deviceName = payload.copyType === 'kitchen' ? settings.kitchenPrinterName : settings.receiptPrinterName;
    if (!deviceName) throw new Error(`${payload.copyType} printer is not configured`);
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } });
    try {
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(renderReceiptHtml(payload, settings)));
      await new Promise((resolve, reject) => {
        win.webContents.print({ silent: true, deviceName, pageSize: { width: PAPER_WIDTHS[payload.paper], height: 200000 } }, (success, reason) => success ? resolve() : reject(new Error(reason || 'Print failed')));
      });
    } finally {
      if (!win.isDestroyed()) win.destroy();
    }
  }

  record(job) {
    const index = this.history.findIndex((item) => item.id === job.id);
    if (index >= 0) this.history[index] = { ...job };
    else this.history.unshift({ ...job });
    this.history = this.history.slice(0, HISTORY_LIMIT);
  }
}
