import { BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'path';
import DisplayManager from './displayManager';
import { DISPLAY_WINDOW_ID, POS_SESSION_PARTITION } from './config';
import {
  selectDisplay,
  validateFullScreenOptions,
  validateOpenWindowOptions,
  validateWindowOptions
} from './displayUtils';
import {
  APP_ORIGIN,
  DEFAULT_ROUTE,
  appUrl,
  electronUserAgent,
  isBrowserOnlyRoute,
  isElectronRoute,
  isLogoutRoute,
  openInBrowser
} from './navigation';
import { attachRecovery } from './recovery';

const IPC_CHANNELS = ['focus-window', 'set-full-screen', 'get-display-info', 'open-window'];
export default class MainWindow extends BrowserWindow {
  constructor(main, autoUpdater, preferences) {
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
    this.autoUpdater = autoUpdater;
    this.preferences = preferences;
    this.activeWindows = new Map();
    this.targetUrl = appUrl(DEFAULT_ROUTE);
    this.screenHandlers = [];
    this.webContents.setUserAgent(electronUserAgent(this.webContents.getUserAgent()));
    attachRecovery(this, () => this.targetUrl);
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
    this.on('closed', () => this.cleanup());
  }
  configureNavigation() {
    this.webContents.on('will-navigate', (event, url) => {
      if (isLogoutRoute(url)) {
        event.preventDefault();
        this.logout();
      } else if (!isElectronRoute(url)) {
        event.preventDefault();
        if (isBrowserOnlyRoute(url) || /^https?:/.test(url)) openInBrowser(url);
      } else {
        this.targetUrl = url;
      }
    });
    this.webContents.setWindowOpenHandler(({ url }) => {
      if (isElectronRoute(url)) {
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
      'open-window',
      this.ipcResult(null, async (raw = {}) => {
        const options = validateOpenWindowOptions(raw);
        const existing = this.activeWindows.get(DISPLAY_WINDOW_ID);
        if (existing && !existing.isDestroyed()) {
          existing.show();
          existing.focus();
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
      })
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
      'get-display-info',
      this.ipcResult(null, async () => {
        const active = this.activeWindows.get(DISPLAY_WINDOW_ID);
        return {
          success: true,
          displays: screen.getAllDisplays().map((display) => ({
            id: String(display.id),
            bounds: display.bounds,
            isInternal: display.internal,
            isActive: active?.displayId === String(display.id)
          })),
          activeWindows:
            active && !active.isDestroyed()
              ? [{ id: DISPLAY_WINDOW_ID, displayId: active.displayId, bounds: active.getBounds() }]
              : []
        };
      })
    );
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
  async relocateDisplay() {
    const display = this.activeWindows.get(DISPLAY_WINDOW_ID);
    if (!display || display.isDestroyed()) return;
    const target = selectDisplay(
      screen.getAllDisplays(),
      display.displayId,
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
