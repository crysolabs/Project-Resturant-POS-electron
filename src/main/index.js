import { app, BrowserWindow, dialog, session } from 'electron';
import { optimizer } from '@electron-toolkit/utils';
import { autoUpdater } from 'electron-updater';
import { join } from 'path';
import MainWindow from './src/site';
import AppTray from './src/tray';
import Preferences from './src/preferences';
import { POS_SESSION_PARTITION } from './src/config';
import { electronUserAgent } from './src/navigation';
import packageJson from '../../package.json';

class ElectronApp {
  constructor() {
    this.preview = packageJson.preview || false;
    this.devMode = !app.isPackaged;
    const baseName = packageJson.build.productName || 'Electron App';
    this.appName = this.devMode
      ? baseName + ' (Dev)'
      : this.preview
        ? baseName + ' (Preview)'
        : baseName;
    this.appId = packageJson.build.appId || 'com.electron.app';
    this.appDescription = packageJson.description || 'Electron application';
    this.appIconPath = join(__dirname, '../../build/resources/icon.png');
    this.mainWindow = null;
    this.tray = null;
    this.preferences = null;
  }
  configureAppSettings() {
    if (!app.requestSingleInstanceLock()) {
      app.quit();
      return false;
    }
    app.on('second-instance', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    });
    app.on('window-all-closed', () => {});
    app.setName(this.appName);
    app.setAppUserModelId(this.appId);
    if (app.isPackaged)
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: false,
        enabled: true,
        name: this.appName,
        path: app.getPath('exe')
      });
    return true;
  }
  configureSession() {
    const sharedSession = session.fromPartition(POS_SESSION_PARTITION);
    sharedSession.setUserAgent(electronUserAgent(sharedSession.getUserAgent()));
    sharedSession.webRequest.onBeforeSendHeaders((details, callback) =>
      callback({
        requestHeaders: {
          ...details.requestHeaders,
          'User-Agent': electronUserAgent(details.requestHeaders['User-Agent'] || '')
        }
      })
    );
  }
  configureUpdater() {
    if (!app.isPackaged) return;
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: import.meta.env.MAIN_VITE_GITHUB_USERNAME,
      repo: import.meta.env.MAIN_VITE_GITHUB_REPO,
      releaseType: this.preview ? 'prerelease' : 'release'
    });
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.on('error', (error) => console.error('AutoUpdater error:', error));
    autoUpdater.on('update-downloaded', async (info) => {
      this.mainWindow?.send('update-info', { status: 'downloaded', version: info.version });
      const result = await dialog.showMessageBox(this.mainWindow, {
        type: 'info',
        title: 'Update ready',
        message: 'Restaurant POS ' + info.version + ' is ready to install.',
        detail: 'Install now? The POS will restart.',
        buttons: ['Install and restart', 'Later'],
        defaultId: 0,
        cancelId: 1
      });
      if (result.response === 0) autoUpdater.quitAndInstall(false, true);
    });
    setTimeout(
      () =>
        autoUpdater
          .checkForUpdates()
          .catch((error) => console.error('Update check failed:', error)),
      5000
    );
  }
  async createWindows() {
    this.preferences = new Preferences();
    await this.preferences.load();
    this.tray = new AppTray(this);
    this.tray.create();
    this.mainWindow = new MainWindow(this, autoUpdater, this.preferences);
    this.tray.setMainWindow(this.mainWindow);
    await this.mainWindow.load();
  }
  async initialize() {
    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window));
    await this.createWindows();
    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) await this.createWindows();
      else this.mainWindow?.show();
    });
  }
}

async function launchApp() {
  const instance = new ElectronApp();
  if (!instance.configureAppSettings()) return;
  await app.whenReady();
  instance.configureSession();
  instance.configureUpdater();
  try {
    await instance.initialize();
  } catch (error) {
    console.error('Application startup failed:', error);
    dialog.showErrorBox('Application Error', 'Failed to start: ' + error.message);
    app.quit();
  }
}
launchApp();
