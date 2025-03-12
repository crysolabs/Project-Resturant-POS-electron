import electron, { BrowserWindow, app, ipcMain } from 'electron';
import { join } from 'path';
import { printer as ThermalPrinter, types as PrinterTypes } from 'node-thermal-printer';
const siteWindow = class extends BrowserWindow {
  constructor(autoUpdater) {
    super({
      width: electron.screen.getPrimaryDisplay().workAreaSize.width,
      height: electron.screen.getPrimaryDisplay().workAreaSize.height,
      autoHideMenuBar: true,
      icon: join(__dirname, '../../build/resources/icon.png'),
      title: '',
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        nodeIntegration: true,
        contextIsolation: true
      }
    });
    this.hasUpdates = false;
    this.updateInterval;
    this.autoUpdater = autoUpdater;
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
