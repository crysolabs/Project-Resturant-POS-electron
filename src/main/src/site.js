import { BrowserWindow, app, ipcMain, screen, shell } from 'electron';
import { join } from 'path';
import DisplayManager from './displayManager';
import { DISPLAY_WINDOW_ID, POS_SESSION_PARTITION } from './config';
import {
  displayLabel,
  selectDisplay,
  validateDisplayPreferences,
  validateFullScreenOptions,
  validateOpenWindowOptions,
  validateWindowOptions
} from './displayUtils';
import {
  APP_ORIGIN,
  DEFAULT_ROUTE,
  appUrl,
  electronUserAgent,
  isDisplayRoute,
  isBrowserOnlyRoute,
  isElectronRoute,
  isLogoutRoute,
  openInBrowser
} from './navigation';
import { attachRecovery } from './recovery';
import { logDesktopEvent, safeDesktopDiagnostics } from './diagnostics.js';
import HardwareManager from './hardware.js';
import { desktopCompatibility } from './compatibility.js';

const IPC_CHANNELS = [
  'window-control',
  'get-window-state',
  'close-window',
  'get-app-info',
  'check-for-updates',
  'download-update',
  'install-update',
  'open-external',
  'focus-window',
  'set-full-screen',
  'get-display-info',
  'get-display-preferences',
  'set-display-preferences',
  'hardware-get-capabilities',
  'hardware-list-printers',
  'hardware-get-settings',
  'hardware-set-settings',
  'hardware-preview-receipt',
  'hardware-print-receipt',
  'hardware-test-print',
  'hardware-open-cash-drawer',
  'hardware-get-print-history',
  'get-diagnostics',
  'open-window'
];
export default class MainWindow extends BrowserWindow {
  constructor(main, updater, preferences) {
    const primary = screen.getPrimaryDisplay();
    super({
      width: 1440,
      height: 900,
      minWidth: 1024,
      minHeight: 700,
      x: primary.bounds.x,
      y: primary.bounds.y,
      backgroundColor: '#f6f8fb',
      autoHideMenuBar: true,
      frame: false,
      icon: main.appIconPath,
      title: main.appName,
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        partition: POS_SESSION_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    this.main = main;
    this.updater = updater;
    this.preferences = preferences;
    this.hardware = new HardwareManager(this, preferences);
    this.activeWindows = new Map();
    this.targetUrl = appUrl(DEFAULT_ROUTE);
    this.screenHandlers = [];
    this.webContents.setUserAgent(electronUserAgent(this.webContents.getUserAgent()));
    attachRecovery(this, () => this.targetUrl, { showOfflineAfterFirstLoad: false });
    this.configureNavigation();
    this.configureWindowEvents();
    this.registerIpc();
    this.registerDisplayEvents();
  }
  send(event, payload) {
    if (!this.isDestroyed()) this.webContents.send(event, payload);
  }
  configureWindowEvents() {
    this.on('hide', () => this.activeWindows.forEach((window) => window.hide()));
    this.on('show', () => this.activeWindows.forEach((window) => window.show()));
    this.on('maximize', () => this.send('window-state-changed', this.getWindowState()));
    this.on('unmaximize', () => this.send('window-state-changed', this.getWindowState()));
    this.on('enter-full-screen', () => this.send('window-state-changed', this.getWindowState()));
    this.on('leave-full-screen', () => this.send('window-state-changed', this.getWindowState()));
    this.on('closed', () => this.cleanup());
  }
  configureNavigation() {
    this.webContents.on('will-navigate', (event, url) => {
      if (isLogoutRoute(url)) {
        event.preventDefault();
        this.logout();
      } else if (isDisplayRoute(url)) {
        event.preventDefault();
        this.openCustomerDisplay({});
      } else if (!isElectronRoute(url)) {
        event.preventDefault();
        if (isBrowserOnlyRoute(url) || /^https?:/.test(url)) openInBrowser(url);
      } else {
        this.targetUrl = url;
      }
    });
    this.webContents.setWindowOpenHandler(({ url }) => {
      if (isDisplayRoute(url)) {
        this.openCustomerDisplay({});
      } else if (isElectronRoute(url)) {
        this.targetUrl = url;
        this.loadURL(url);
      } else if (isLogoutRoute(url)) this.logout();
      else if (isBrowserOnlyRoute(url) || /^https?:/.test(url)) openInBrowser(url);
      return { action: 'deny' };
    });
    this.webContents.session.webRequest.onCompleted(
      { urls: [APP_ORIGIN + '/logout*', APP_ORIGIN + '/sign-out*', APP_ORIGIN + '/signout*'] },
      () => this.logout()
    );
    this.webContents.session.webRequest.onCompleted(
      { urls: [APP_ORIGIN + '/api/*'] },
      (details) => {
        if ([401, 402, 403].includes(details.statusCode)) {
          this.send('access-state-changed', {
            statusCode: details.statusCode,
            reason:
              details.statusCode === 401
                ? 'expired-or-revoked-session'
                : details.statusCode === 402
                  ? 'restricted-plan-or-suspended-tenant'
                  : 'restricted-capability'
          });
        }
      }
    );
    this.webContents.session.on('will-download', (event) => {
      event.preventDefault();
      this.send('download-blocked', { reason: 'Downloads are disabled in the POS shell' });
      logDesktopEvent('warn', 'desktop.download.blocked', {
        reason: 'Downloads are disabled in the POS shell'
      });
    });
  }
  isTrustedSender(event) {
    if (!(event.sender === this.webContents) || event.sender.isDestroyed()) return false;
    try {
      const url = new URL(event.senderFrame?.url || this.webContents.getURL());
      return url.origin === APP_ORIGIN;
    } catch {
      return false;
    }
  }
  ipcResult(channel, handler) {
    return async (event, options) => {
      if (!this.isTrustedSender(event)) return { success: false, error: 'Untrusted IPC sender' };
      try {
        const result = await Promise.race([
          handler(options),
          new Promise((_, reject) => setTimeout(() => reject(new Error('IPC timed out')), 35000))
        ]);
        return result;
      } catch (error) {
        logDesktopEvent('error', 'desktop.ipc.failure', { channel, error });
        return { success: false, error: error.message, code: 'IPC_FAILURE' };
      }
    };
  }
  registerIpc() {
    for (const channel of IPC_CHANNELS) ipcMain.removeHandler(channel);
    ipcMain.handle(
      'window-control',
      this.ipcResult(null, async (raw = {}) => {
        const action = raw?.action;
        if (action === 'minimize') this.minimize();
        else if (action === 'maximize') this.isMaximized() ? this.unmaximize() : this.maximize();
        else if (action === 'fullscreen') this.setFullScreen(!this.isFullScreen());
        else if (action === 'close') this.close();
        else throw new Error('Unsupported window action');
        return { success: true, state: this.getWindowState() };
      })
    );
    ipcMain.handle(
      'get-window-state',
      this.ipcResult(null, async () => ({ success: true, state: this.getWindowState() }))
    );
    ipcMain.handle(
      'get-app-info',
      this.ipcResult(null, async () => ({
        success: true,
        app: {
          appName: app.getName(),
          version: app.getVersion(),
          isPackaged: app.isPackaged,
          platform: process.platform,
          updateChannel: this.main.updateChannel
        },
        compatibility: desktopCompatibility({
          app,
          channel: this.main.updateChannel,
          updatePolicy: this.updater.policy
        }),
        update: this.updater.lastInfo
      }))
    );
    ipcMain.handle(
      'get-diagnostics',
      this.ipcResult(null, async () => ({
        success: true,
        diagnostics: safeDesktopDiagnostics({
          appOrigin: APP_ORIGIN,
          compatibility: desktopCompatibility({
            app,
            channel: this.main.updateChannel,
            updatePolicy: this.updater.policy
          }),
          updateState: this.updater.lastInfo,
          activeWindows: [...this.activeWindows.values()]
            .filter((window) => !window.isDestroyed())
            .map((window) => ({
              id: window.windowId,
              displayId: window.displayId,
              bounds: window.getBounds()
            }))
        })
      }))
    );
    ipcMain.handle(
      'check-for-updates',
      this.ipcResult(null, async () => ({
        success: true,
        update: await this.updater.checkForUpdates({ manual: true })
      }))
    );
    ipcMain.handle(
      'download-update',
      this.ipcResult(null, async () => ({
        success: true,
        update: await this.updater.downloadUpdate()
      }))
    );
    ipcMain.handle(
      'install-update',
      this.ipcResult(null, async () => this.updater.installUpdate())
    );
    ipcMain.handle(
      'open-external',
      this.ipcResult(null, async (url) => {
        if (typeof url !== 'string' || !/^(https?:|mailto:)/i.test(url)) {
          throw new Error('Unsupported external URL');
        }
        await shell.openExternal(url);
        return { success: true };
      })
    );
    ipcMain.handle(
      'open-window',
      this.ipcResult(null, async (raw = {}) => this.openCustomerDisplay(raw))
    );
    ipcMain.handle(
      'focus-window',
      this.ipcResult(null, async (raw) => {
        validateWindowOptions(raw);
        const display = this.requireDisplay();
        display.show();
        display.focus();
        return {
          success: true,
          windowId: DISPLAY_WINDOW_ID,
          displayId: display.displayId,
          status: 'focused'
        };
      })
    );
    ipcMain.handle(
      'set-full-screen',
      this.ipcResult(null, async (raw) => {
        const options = validateFullScreenOptions(raw);
        const display = this.requireDisplay();
        display.setDisplayMode(options.fullscreen, options.fullscreen);
        return {
          success: true,
          windowId: DISPLAY_WINDOW_ID,
          displayId: display.displayId,
          fullscreen: options.fullscreen
        };
      })
    );
    ipcMain.handle(
      'close-window',
      this.ipcResult(null, async (raw) => {
        validateWindowOptions(raw);
        const display = this.requireDisplay();
        display.close();
        return { success: true, windowId: DISPLAY_WINDOW_ID };
      })
    );
    ipcMain.handle(
      'get-display-info',
      this.ipcResult(null, async () => {
        const active = this.activeWindows.get(DISPLAY_WINDOW_ID);
        const primary = screen.getPrimaryDisplay();
        const preferences = this.getDisplayPreferences();
        return {
          success: true,
          preferences,
          displays: screen.getAllDisplays().map((display) => ({
            id: String(display.id),
            label: displayLabel(display, primary.id),
            bounds: display.bounds,
            isInternal: display.internal,
            isPrimary: String(display.id) === String(primary.id),
            isCashierDisplay: preferences.cashierDisplayId === String(display.id),
            isCustomerDisplay: preferences.customerDisplayId === String(display.id),
            isActive: active?.displayId === String(display.id)
          })),
          activeWindows:
            active && !active.isDestroyed()
              ? [{ id: DISPLAY_WINDOW_ID, displayId: active.displayId, bounds: active.getBounds() }]
              : []
        };
      })
    );
    ipcMain.handle(
      'hardware-get-capabilities',
      this.ipcResult('hardware-get-capabilities', async () => ({
        success: true,
        capabilities: this.hardware.capabilities()
      }))
    );
    ipcMain.handle(
      'hardware-list-printers',
      this.ipcResult('hardware-list-printers', async () => ({
        success: true,
        printers: await this.hardware.printers()
      }))
    );
    ipcMain.handle(
      'hardware-get-settings',
      this.ipcResult('hardware-get-settings', async () => ({
        success: true,
        settings: this.hardware.settings()
      }))
    );
    ipcMain.handle(
      'hardware-set-settings',
      this.ipcResult('hardware-set-settings', async (raw = {}) => ({
        success: true,
        settings: await this.hardware.setSettings(raw)
      }))
    );
    ipcMain.handle(
      'hardware-preview-receipt',
      this.ipcResult('hardware-preview-receipt', async (raw = {}) => ({
        success: true,
        preview: await this.hardware.previewReceipt(raw)
      }))
    );
    ipcMain.handle(
      'hardware-print-receipt',
      this.ipcResult('hardware-print-receipt', async (raw = {}) => ({
        success: true,
        job: await this.hardware.printReceipt(raw)
      }))
    );
    ipcMain.handle(
      'hardware-test-print',
      this.ipcResult('hardware-test-print', async (raw = {}) => ({
        success: true,
        job: await this.hardware.testPrint(raw)
      }))
    );
    ipcMain.handle(
      'hardware-open-cash-drawer',
      this.ipcResult('hardware-open-cash-drawer', async (raw = {}) => ({
        success: true,
        job: await this.hardware.openCashDrawer(raw)
      }))
    );
    ipcMain.handle(
      'hardware-get-print-history',
      this.ipcResult('hardware-get-print-history', async () => ({
        success: true,
        history: this.hardware.getHistory()
      }))
    );
    ipcMain.handle(
      'get-display-preferences',
      this.ipcResult(null, async () => ({
        success: true,
        preferences: this.getDisplayPreferences()
      }))
    );
    ipcMain.handle(
      'set-display-preferences',
      this.ipcResult(null, async (raw = {}) => {
        const preferences = validateDisplayPreferences(raw);
        for (const [key, value] of Object.entries(preferences))
          await this.preferences.set(key, value);
        await this.placeCashierWindow();
        await this.relocateDisplay(true);
        return { success: true, preferences: this.getDisplayPreferences() };
      })
    );
  }
  getWindowState() {
    return {
      isMaximized: this.isMaximized(),
      isMinimized: this.isMinimized(),
      isFullScreen: this.isFullScreen()
    };
  }
  checkUpdates() {
    return this.updater.checkForUpdates();
  }
  async openCustomerDisplay(raw = {}) {
    const options = validateOpenWindowOptions(raw);
    const existing = this.activeWindows.get(DISPLAY_WINDOW_ID);
    if (existing && !existing.isDestroyed()) {
      existing.show();
      existing.focus();
      existing.setDisplayMode(options.fullscreen, options.kiosk);
      return {
        success: true,
        windowId: DISPLAY_WINDOW_ID,
        displayId: existing.displayId,
        status: 'focused'
      };
    }
    const display = new DisplayManager(this, options);
    this.activeWindows.set(DISPLAY_WINDOW_ID, display);
    await this.preferences.set('customerDisplayId', display.displayId);
    display.once('closed', () => {
      this.activeWindows.delete(DISPLAY_WINDOW_ID);
      this.send('display-closed', {
        windowId: DISPLAY_WINDOW_ID,
        displayId: display.displayId,
        reason: 'closed'
      });
    });
    await display.load();
    logDesktopEvent('info', 'desktop.display.opened', {
      windowId: DISPLAY_WINDOW_ID,
      displayId: display.displayId
    });
    this.send('display-loaded', {
      windowId: DISPLAY_WINDOW_ID,
      displayId: display.displayId,
      status: 'created'
    });
    return {
      success: true,
      windowId: DISPLAY_WINDOW_ID,
      displayId: display.displayId,
      status: 'created'
    };
  }
  getDisplayPreferences() {
    return {
      cashierDisplayId: this.preferences.get('cashierDisplayId') || null,
      customerDisplayId: this.preferences.get('customerDisplayId') || null
    };
  }
  async placeCashierWindow() {
    const target = selectDisplay(
      screen.getAllDisplays(),
      this.preferences.get('cashierDisplayId'),
      null
    );
    if (!target || this.isDestroyed()) return;
    const current = screen.getDisplayMatching(this.getBounds());
    if (String(current.id) === String(target.id)) return;
    this.setBounds({
      x: target.workArea.x,
      y: target.workArea.y,
      width: Math.min(Math.max(1024, this.getBounds().width), target.workArea.width),
      height: Math.min(Math.max(700, this.getBounds().height), target.workArea.height)
    });
  }
  requireDisplay() {
    const display = this.activeWindows.get(DISPLAY_WINDOW_ID);
    if (!display || display.isDestroyed()) throw new Error('Window not found');
    return display;
  }
  registerDisplayEvents() {
    for (const eventName of ['display-added', 'display-removed', 'display-metrics-changed']) {
      const handler = () => this.relocateDisplay();
      screen.on(eventName, handler);
      this.screenHandlers.push([eventName, handler]);
    }
  }
  async relocateDisplay(preferRemembered = false) {
    const display = this.activeWindows.get(DISPLAY_WINDOW_ID);
    if (!display || display.isDestroyed()) return;
    const target = selectDisplay(
      screen.getAllDisplays(),
      preferRemembered ? null : display.displayId,
      this.preferences.get('customerDisplayId')
    );
    if (!target) return;
    display.placeOn(target);
    await this.preferences.set('customerDisplayId', String(target.id));
  }
  async logout() {
    for (const display of this.activeWindows.values()) display.cleanup();
    this.activeWindows.clear();
    await this.webContents.session.clearStorageData({
      storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage']
    });
    this.targetUrl = appUrl(DEFAULT_ROUTE);
    await this.loadURL(this.targetUrl);
  }
  async load() {
    await this.placeCashierWindow();
    try {
      await this.loadURL(this.targetUrl);
    } catch {
      /* recovery handler owns retry */
    }
    this.show();
  }
  cleanup() {
    for (const channel of IPC_CHANNELS) ipcMain.removeHandler(channel);
    for (const [eventName, handler] of this.screenHandlers)
      screen.removeListener(eventName, handler);
    for (const display of this.activeWindows.values()) display.cleanup();
    this.activeWindows.clear();
  }
}
