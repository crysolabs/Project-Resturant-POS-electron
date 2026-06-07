import electron, { BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { printer as ThermalPrinter } from 'node-thermal-printer';
import DisplayManager from './displayManager';
import {
  APP_ORIGIN,
  DEFAULT_ROUTE,
  DISPLAY_ROUTE,
  appUrl,
  electronUserAgent,
  isBrowserOnlyRoute,
  isElectronRoute,
  isLogoutRoute,
  openInBrowser
} from './navigation';

const DISPLAY_WINDOW_ID = 'customer-display';

const siteWindow = class extends BrowserWindow {
  constructor(main, autoUpdater) {
    const primaryDisplay = electron.screen.getPrimaryDisplay();
    const preloadPath = join(__dirname, '../preload/index.js');

    super({
      width: 1440,
      height: 900,
      minWidth: 1024,
      minHeight: 700,
      x: primaryDisplay.bounds.x,
      y: primaryDisplay.bounds.y,
      backgroundColor: '#f6f8fb',
      autoHideMenuBar: true,
      icon: main.appIconPath,
      title: main.appName,
      show: false,
      maximizable: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    this.main = main;
    this.hasUpdates = false;
    this.updateInterval = null;
    this.autoUpdater = autoUpdater;
    this.activeWindows = new Map();
    this.webContents.setUserAgent(electronUserAgent(this.webContents.getUserAgent()));

    // Handle window state changes
    this.on('hide', this.handleMainWindowHide.bind(this));
    this.on('show', this.handleMainWindowShow.bind(this));
    this.on('minimize', this.handleMainWindowHide.bind(this));
    this.on('restore', this.handleMainWindowShow.bind(this));
    this.on('closed', this.cleanup.bind(this));
  }

  send(event, data) {
    this.webContents.send(event, data);
  }

  handleMainWindowHide() {
    this.activeWindows.forEach((window) => {
      if (window.isVisible()) {
        window.hide();
      }
    });
  }

  handleMainWindowShow() {
    this.activeWindows.forEach((window) => {
      if (!window.isVisible()) {
        window.show();
      }
    });
  }

  cleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.autoUpdater) {
      this.autoUpdater.removeAllListeners();
    }

    this.activeWindows.forEach((window) => {
      window.cleanup();
    });
    this.activeWindows.clear();
  }

  async clearSessionAndLoadLogin() {
    await this.webContents.session.clearStorageData({
      storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage']
    });
    await this.loadURL(appUrl(DEFAULT_ROUTE), {
      userAgent: electronUserAgent(this.webContents.getUserAgent())
    });
  }

  configureNavigation() {
    this.webContents.on('will-navigate', (event, url) => {
      if (isLogoutRoute(url)) {
        event.preventDefault();
        this.clearSessionAndLoadLogin();
        return;
      }

      if (isElectronRoute(url)) return;

      event.preventDefault();
      if (isBrowserOnlyRoute(url) || /^https?:\/\//.test(url)) {
        openInBrowser(url);
      }
    });

    this.webContents.session.webRequest.onCompleted(
      { urls: [`${APP_ORIGIN}/logout*`, `${APP_ORIGIN}/sign-out*`, `${APP_ORIGIN}/signout*`] },
      () => {
        this.clearSessionAndLoadLogin();
      }
    );

    this.webContents.setWindowOpenHandler(({ url }) => {
      if (isElectronRoute(url)) {
        this.loadURL(url, { userAgent: electronUserAgent(this.webContents.getUserAgent()) });
      } else if (isLogoutRoute(url)) {
        this.clearSessionAndLoadLogin();
      } else if (isBrowserOnlyRoute(url) || /^https?:\/\//.test(url)) {
        openInBrowser(url);
      }

      return { action: 'deny' };
    });
  }

  handleEvents() {
    const handleRequestUpdate = (_) => {
      if (!this.hasUpdates) return;
      this.autoUpdater.quitAndInstall(true, true);
    };
    const handlePrintOrderReceipt = async (data) => {
      const printer = new ThermalPrinter.printer({
        type: ThermalPrinter.types.EPSON,
        interface: 'printer:POS-58',
        options: {
          timeout: 1000
        }
      });

      try {
        printer.alignCenter();
        printer.println(data.businessName);
        printer.drawLine();

        data.items.forEach((item) => {
          printer.alignLeft();
          printer.print(`${item.quantity}x ${item.name}`);
          printer.alignRight();
          printer.println(`$${item.price}`);
        });

        printer.drawLine();
        printer.alignRight();
        printer.println(`Total: $${data.total}`);
        printer.cut();

        await printer.execute();
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };
    const handleFocusWindow = (_, options = {}) => {
      try {
        const windowId = options.windowId || DISPLAY_WINDOW_ID;
        const existingWindow = this.activeWindows.get(windowId);

        if (!existingWindow) {
          return { success: false, error: 'Window not found' };
        }

        existingWindow.show();
        existingWindow.focus();
        return { success: true, windowId, status: 'focused' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };
    const handleSetFullScreen = (_, options = {}) => {
      try {
        const windowId = options.windowId || DISPLAY_WINDOW_ID;
        const existingWindow = this.activeWindows.get(windowId);

        if (!existingWindow) {
          return { success: false, error: 'Window not found' };
        }

        const fullScreen = options.fullScreen !== false;
        existingWindow.setFullScreen(fullScreen);
        existingWindow.setKiosk(fullScreen);
        return { success: true, windowId, fullScreen };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };
    const handleOpenWindow = async (_, options = {}) => {
      try {
        const windowId = DISPLAY_WINDOW_ID;

        if (this.activeWindows.has(windowId)) {
          const existingWindow = this.activeWindows.get(windowId);
          existingWindow.show();
          existingWindow.focus();
          return { success: true, windowId, status: 'focused' };
        }

        const displayManager = new DisplayManager(this, { ...options, windowId });
        this.activeWindows.set(windowId, displayManager);
        displayManager.on('closed', () => {
          this.activeWindows.delete(windowId);
          this.send('display-closed', { windowId });
        });

        await displayManager.load(appUrl(DISPLAY_ROUTE));
        this.send('display-loaded', { windowId });

        return { success: true, windowId, status: 'created' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };
    const handleCloseWindow = async (_, options = {}) => {
      try {
        const windowId =
          typeof options === 'string' ? options : options.windowId || DISPLAY_WINDOW_ID;
        const window = this.activeWindows.get(windowId);
        if (!window) throw new Error('Window not found');

        window.cleanup();
        this.activeWindows.delete(windowId);
        this.send('display-closed', { windowId });
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    const handleGetDisplayInfo = () => {
      const displays = electron.screen.getAllDisplays();
      const activeDisplays = Array.from(this.activeWindows.entries()).map(([id, window]) => ({
        id,
        bounds: window.getBounds(),
        displayId: window.displayId
      }));

      return {
        success: true,
        displays: displays.map((display) => ({
          id: display.id,
          bounds: display.bounds,
          isInternal: display.internal,
          isActive: activeDisplays.some((activeDisplay) => activeDisplay.displayId === display.id)
        })),
        activeWindows: activeDisplays
      };
    };
    const handleCheckForUpdates = () => {
      this.checkUpdates();
    };
    ipcMain.handle('focus-window', handleFocusWindow);
    ipcMain.handle('set-full-screen', handleSetFullScreen);
    ipcMain.handle('get-display-info', handleGetDisplayInfo);
    ipcMain.handle('open-window', handleOpenWindow);
    ipcMain.handle('close-window', handleCloseWindow);
    ipcMain.on('install-updates', handleRequestUpdate);
    ipcMain.on('check-for-updates', handleCheckForUpdates);
    ipcMain.handle('print-order-receipt', handlePrintOrderReceipt);
  }
  checkUpdates() {
    this.autoUpdater.checkForUpdates();
  }
  updateHandler() {
    this.updateInterval = setInterval(async () => {
      this.checkUpdates();
    }, 1000 * 60);
    const handleUpdateDownload = () => {
      this.hasUpdates = true;
      this.send('update-info', { status: 'downloaded' });
    };
    this.autoUpdater.on('update-downloaded', handleUpdateDownload);
  }
  async load() {
    this.configureNavigation();
    await this.loadURL(appUrl(DEFAULT_ROUTE), {
      userAgent: electronUserAgent(this.webContents.getUserAgent())
    });
    await new Promise((resolve) => {
      this.once('ready-to-show', resolve);
    });
    this.show();
    this.handleEvents();
    this.updateHandler();
  }
};
export default siteWindow;
