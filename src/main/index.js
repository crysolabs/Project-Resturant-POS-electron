import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { autoUpdater } from 'electron-updater';
import { join } from 'path';
import MainWindow from './src/site';
import SplashScreen from './src/loader';
import AppTray from './src/tray';
import packageJson from '../../package.json';
import log from 'electron-log';
import { existsSync, readdirSync } from 'fs';
class ElectronApp {
  constructor() {
    this.appName = packageJson.build.productName || 'Electron App';
    this.appId = packageJson.build.appId || 'com.electron.app';
    this.appDescription = packageJson.description || 'Electron application';
    this.appIconPath = app.isPackaged
      ? join(__dirname, '../../build/resources/icon.png')
      : join(__dirname, '../../build/resources/icon.png');

    this.splashScreen = null;
    this.mainWindow = null;
    this.tray = null;
  }

  setupAutoUpdater() {
    try {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: import.meta.env.MAIN_VITE_GITHUB_USERNAME,
        repo: import.meta.env.MAIN_VITE_GITHUB_REPO,
        releaseType: packageJson.preview ? 'prerelease' : 'release'
      });

      autoUpdater.forceDevUpdateConfig = true;
      autoUpdater.autoDownload = true;
      autoUpdater.autoRunAppAfterInstall = true;

      autoUpdater.on('error', (error) => console.error('AutoUpdater Error:', error));
      return true;
    } catch (error) {
      console.error('Failed to setup AutoUpdater:', error);
      return false;
    }
  }

  async createWindows() {
    try {
      this.tray = new AppTray(this);
      this.tray.create();

      this.splashScreen = new SplashScreen(this, autoUpdater);
      await this.splashScreen.load();

      this.mainWindow = new MainWindow(this, autoUpdater);
      await this.mainWindow.load();
      this.splashScreen.close();

      if (this.tray) {
        this.tray.setMainWindow(this.mainWindow);
      }

      return this.mainWindow;
    } catch (error) {
      console.error('Error creating windows:', error);
      dialog.showErrorBox('Application Error', `Failed to start: ${error.message}`);
      return null;
    }
  }

  configureAppSettings() {
    if (app.isPackaged) {
      app.setName(this.appName);
      app.setAppUserModelId(this.appId);
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: true,
        path: app.getPath('exe')
      });
    }
  }

  optimizeWindows() {
    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window));
  }

  async initialize() {
    try {
      this.configureAppSettings();
      this.optimizeWindows();

      const mainWindow = await this.createWindows();
      if (!mainWindow) throw new Error('Main window creation failed');

      app.on('activate', async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          await this.createWindows();
        } else if (this.mainWindow && !this.mainWindow.isVisible()) {
          this.mainWindow.show();
        }
      });

      return true;
    } catch (error) {
      console.error('Initialization failed:', error);
      return false;
    }
  }

  setupErrorHandling() {
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      dialog.showErrorBox('Unexpected Error', `An unexpected error occurred: ${error.message}`);
    });
  }
}

async function launchApp() {
  const electronAppInstance = new ElectronApp();

  await app.whenReady();
  electronAppInstance.setupErrorHandling();
  electronAppInstance.setupAutoUpdater();

  const initialized = await electronAppInstance.initialize();
  if (!initialized) {
    console.error('Application startup failed');
    app.quit();
  }

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      // Keep app running in tray
    }
  });
}

launchApp();
