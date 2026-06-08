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
  }
  isTrustedSender(event) {
    return event.sender === this.webContents && !event.sender.isDestroyed();
  }
  ipcResult(event, handler) {
    return async (_event, options) => {
      if (!this.isTrustedSender(_event)) return { success: false, error: 'Untrusted IPC sender' };
      try {
        return await handler(options);
      } catch (error) {
        return { success: false, error: error.message };
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
          platform: process.platform
        },
        update: this.updater.lastInfo
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
