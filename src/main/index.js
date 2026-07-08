import { app, BrowserWindow, Menu, dialog, session } from 'electron';
import { optimizer } from '@electron-toolkit/utils';
import { join } from 'path';
import MainWindow from './src/site';
import AppTray from './src/tray';
import Preferences from './src/preferences';
import UpdaterManager from './src/updater';
import { POS_SESSION_PARTITION } from './src/config';
import { resolveUpdateChannel } from './src/compatibility.js';
import { electronUserAgent } from './src/navigation';
import { logDesktopEvent } from './src/diagnostics.js';
import packageJson from '../../package.json';

class ElectronApp {
  constructor() {
    this.preview = packageJson.preview || false;
    this.devMode = !app.isPackaged;
    this.updateChannel = resolveUpdateChannel({ preview: this.preview, packaged: app.isPackaged });
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
    this.updater = new UpdaterManager(this);
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
    Menu.setApplicationMenu(null);
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
    this.updater.configure();
  }
  async createWindows() {
    this.preferences = new Preferences();
    await this.preferences.load();
    this.tray = new AppTray(this);
    this.tray.create();
    this.mainWindow = new MainWindow(this, this.updater, this.preferences);
    this.tray.setMainWindow(this.mainWindow);
    await this.mainWindow.load();
  }
  async initialize() {
    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window));
    await this.createWindows();
    logDesktopEvent('info', 'desktop.launch.ready', {
      preview: this.preview,
      devMode: this.devMode,
      updateChannel: this.updateChannel
    });
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
    logDesktopEvent('fatal', 'desktop.launch.failed', { error });
    dialog.showErrorBox('Application Error', 'Failed to start: ' + error.message);
    app.quit();
  }
}
launchApp();
