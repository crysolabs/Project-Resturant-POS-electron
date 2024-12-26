import electron, { BrowserWindow, app, ipcMain } from 'electron';
import { join } from 'path';
const loaderWindow = class extends BrowserWindow {
  constructor(siteWindow, autoUpdater) {
    super({
      height: 500,
      width: 450,
      resizable: false,
      autoHideMenuBar: true,
      show: false,
      titleBarStyle: 'hidden',
      icon: join(__dirname, '../../build/resources/icon.png'),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        nodeIntegration: true,
        contextIsolation: true
      }
    });
    this.autoUpdater = autoUpdater;
    this.siteWindow = siteWindow;
    this.retryies = 0;
    this.retryTime = Number(import.meta.env.MAIN_VITE_RETRYTIME);
  }
  send(event, data) {
    this.webContents.send(event, data);
  }
  handleEvents() {
    const handleClose = () => {
      this.destroy();
    };
    this.once('close', handleClose);
  }
  handleClearUpdates() {
    this.autoUpdater.removeAllListeners();
  }
  reset() {
    this.retryies = 0;
  }
  checkUpdates(resolve, reject) {
    this.send('loading-status', {
      status: 'Checking For Updates...',
      type: 'check',
      progress: 0
    });

    this.autoUpdater.checkForUpdates();
    this.autoUpdater.on('update-not-available', resolve);

    this.autoUpdater.on('download-progress', (info) => {
      const message = {
        status: 'Downloading Update...',
        type: 'download',
        progress: info.percent,
        speed: info.bytesPerSecond,
        transferred: info.transferred,
        total: info.total
      };
      this.send('loading-status', message);
    });

    this.autoUpdater.on('update-downloaded', () => {
      this.installUpdates(resolve, reject);
    });

    this.autoUpdater.on('error', async () => {
      await this.retry(resolve, reject);
    });
  }
  async installUpdates(resolve, reject) {
    const installMessage = () => {
      const message = {
        status: 'Installing Update...',
        type: 'install',
        progress: 100,
        remainingTime: this.retryTime / 1000 - time,
        total: this.retryTime / 1000
      };
      this.send('loading-status', message);
      time++;
    };

    let time = 0;
    installMessage();
    const timeInterval = setInterval(() => {
      installMessage();
    }, 1000);

    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, this.retryTime);
    });
    clearInterval(timeInterval);
    this.autoUpdater.quitAndInstall(false, true);
  }

  async retry(resolve, reject) {
    const retryMessage = () => {
      const message = {
        status: 'Retrying connection...',
        type: 'retry',
        progress: 0,
        remainingTime: (this.retryTime / 1000) * this.retryies - time,
        attempt: this.retryies,
        total: this.retryTime / 1000
      };
      this.send('loading-status', message);
      time++;
    };

    this.handleClearUpdates();
    this.retryTime / this.retryies !== 1000 && this.retryies++;
    let time = 0;
    retryMessage();
    const timeInterval = setInterval(() => {
      retryMessage();
    }, 1000);

    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, this.retryies * this.retryTime);
    });
    clearInterval(timeInterval);
    this.checkUpdates(resolve, reject);
  }

  async loadWindow() {
    this.send('loading-status', {
      status: 'Starting...'
    });
    await new this.siteWindow(this.autoUpdater).load();
    this.close();
  }

  async load() {
    this.loadFile(join(__dirname, '../renderer/loader/index.html'));
    await new Promise((resolve, reject) => {
      this.once('ready-to-show', () => {
        resolve();
      });
    });
    this.show();
    this.handleEvents();
    await new Promise((resolve, reject) => {
      this.checkUpdates(resolve, reject);
    });
    this.reset();
    this.handleClearUpdates();
    this.loadWindow();
  }
};
export default loaderWindow;
