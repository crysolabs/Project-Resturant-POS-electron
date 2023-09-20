// main.js

import { app, shell, BrowserWindow, ipcMain } from 'electron';
import { join, resolve } from 'path';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import electron from 'electron';
import { autoUpdater } from 'electron-updater';

// Configure the update feed URL (replace 'username' and 'repo' with your GitHub username and repository name).
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'achira22',
  repo: 'Skill-Swap',
  releaseType: 'release'
});
autoUpdater.forceDevUpdateConfig = true;
autoUpdater.autoDownload = true;
autoUpdater.autoRunAppAfterInstall = true;

/**Site Windoow */
const siteWindow = class extends BrowserWindow {
  constructor() {
    super({
      width: electron.screen.getPrimaryDisplay().workAreaSize.width,
      height: electron.screen.getPrimaryDisplay().workAreaSize.height,
      autoHideMenuBar: true,
      icon: join(__dirname, '../../build/resources/icon.png'),
      title: '',
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    const handleClose = () => {
      this.destroy();
    };
    const handleRequestUpdate = () => {};
    this.once('close', handleClose);
    ipcMain.on('request-update', handleRequestUpdate);
  }
  async load() {
    this.loadURL(import.meta.env.MAIN_VITE_APPURI);
    await new Promise((resolve, reject) => {
      this.once('ready-to-show', () => {
        resolve();
      });
    });
    this.show();
  }
};

/**Update Checker Window */
const updateWindow = class extends BrowserWindow {
  constructor() {
    super({
      height: 500,
      width: 400,
      resizable: false,
      autoHideMenuBar: true,
      show: false,
      titleBarStyle: 'hidden',
      focusable: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    this.retryies = 0;
    this.retryTime = Number(import.meta.env.MAIN_VITE_RETRYTIME);
    const handleClose = () => {
      this.destroy();
    };
    this.once('close', handleClose);
  }
  async load() {
    this.loadFile(join(__dirname, '../renderer/index.html'));
    await new Promise((resolve, reject) => {
      this.once('ready-to-show', () => {
        resolve();
      });
    });
    this.show();
    await new Promise((resolve, reject) => {
      this.checkUpdates(resolve, reject);
    });
    this.reset();
    this.handleClearUpdates();
    this.loadWindow();
  }
  handleClearUpdates() {
    autoUpdater.removeAllListeners();
  }
  reset() {
    this.retryies = 0;
  }
  async checkUpdates(resolve, reject) {
    this.webContents.send('update', {
      status: `Checking For Updates...`
    });
    autoUpdater.checkForUpdates();
    autoUpdater.on('update-not-available', resolve);
    autoUpdater.on('download-progress', (info) => {
      const totalMb = info.total * 0.000001;
      this.webContents.send('update', {
        status: `Downloading Updates ${((info.percent * totalMb) / 100).toFixed(
          2
        )}Mb of ${totalMb.toFixed(2)}Mb`
      });
    });
    autoUpdater.on('update-downloaded', () => {
      this.installUpdates(resolve, reject);
    });
    autoUpdater.on('error', async () => {
      await this.retry(resolve, reject);
    });
  }
  async installUpdates(resolve, reject) {
    const installMessage = () => {
      const message = `Installing Updates in ${this.retryTime / 1000 - time}`;
      this.webContents.send('update', {
        status: message
      });
      time++;
    };
    let time = 0;
    installMessage();
    const timeInterval = setInterval(() => {
      installMessage();
    }, 1000);
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve();
      }, this.retryTime);
    });
    clearInterval(timeInterval);
    autoUpdater.quitAndInstall();
  }

  async retry(resolve, reject) {
    const retryMessage = () => {
      const message = `Retrying in ${(this.retryTime / 1000) * this.retryies - time}`;
      this.webContents.send('update', {
        status: message
      });
      time++;
    };
    this.handleClearUpdates();
    this.retryies++;
    let time = 0;
    retryMessage();
    const timeInterval = setInterval(() => {
      retryMessage();
    }, 1000);
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve();
      }, this.retryies * this.retryTime);
    });
    clearInterval(timeInterval);
    this.checkUpdates(resolve, reject);
  }
  async loadWindow() {
    this.webContents.send('update', {
      status: 'Starting...'
    });
    await new siteWindow().load();
    this.close();
  }
};

app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron');
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) new updateWindow().load();
  });
  new updateWindow().load();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
