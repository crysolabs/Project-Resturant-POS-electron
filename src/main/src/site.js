import electron, { BrowserWindow, app, ipcMain } from 'electron';
import { join } from 'path';
import { printer as ThermalPrinter, types as PrinterTypes } from 'node-thermal-printer';
import DisplayManager from './displayManager';

const siteWindow = class extends BrowserWindow {
  constructor(autoUpdater) {
    super({
      width: electron.screen.getPrimaryDisplay().bounds.width,
      height: electron.screen.getPrimaryDisplay().bounds.height,
      x: electron.screen.getPrimaryDisplay().bounds.x,
      y: electron.screen.getPrimaryDisplay().bounds.y,
      autoHideMenuBar: true,
      icon: join(__dirname, '../../build/resources/icon.png'),
      title: '',
      show: false,
      maximizable: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        nodeIntegration: true,
        contextIsolation: true
      }
    });
    this.hasUpdates = false;
    this.updateInterval;
    this.autoUpdater = autoUpdater;
    this.activeWindows = new Map();
  }

  send(event, data) {
    this.webContents.send(event, data);
  }
  handleEvents() {
    const handleClose = () => {
      this.updateInterval && clearInterval(this.updateInterval);
      this.autoUpdater.removeAllListeners();
      this.destroy();
    };
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

        // Print items
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
    const handleOpenWindow = async (_, options) => {
      try {
        // Check for existing window with same ID
        if (options.windowId && this.activeWindows.has(options.windowId)) {
          const existingWindow = this.activeWindows.get(options.windowId);
          existingWindow.focus();
          return { success: true, windowId: options.windowId, status: 'focused' };
        }

        const displayManager = new DisplayManager(options);
        const windowId = await displayManager.load(options.url);
        displayManager.webContents.on('did-finish-load', () => {
          this.send('display-loaded', { windowId });
        });
        displayManager.on('closed', () => {
          this.activeWindows.delete(windowId);
          this.send('display-closed', { windowId });
        });

        this.activeWindows.set(windowId, displayManager);
        return { success: true, windowId, status: 'created' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };
    const handleCloseWindow = async (_, windowId) => {
      try {
        const window = this.activeWindows.get(windowId);
        if (!window) throw new Error('Window not found');

        window.close();
        this.activeWindows.delete(windowId);
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
    ipcMain.handle('get-display-info', handleGetDisplayInfo);
    ipcMain.handle('open-window', handleOpenWindow);
    ipcMain.handle('close-window', handleCloseWindow);
    this.once('close', handleClose);
    ipcMain.on('install-updates', handleRequestUpdate);
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
    this.maximize();
    this.loadURL(import.meta.env.MAIN_VITE_APPURI);
    await new Promise((resolve, reject) => {
      this.once('ready-to-show', () => {
        resolve();
      });
    });
    this.show();
    this.handleEvents();
    this.updateHandler();
  }
};
export default siteWindow;
