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
    this.preview = packageJson.preview || false;
    this.devMode = app.isPackaged ? false : true;
    const baseAppName = packageJson.build.productName || 'Electron App';
    this.appName = this.devMode
      ? `${baseAppName} (Dev)`
      : this.preview
        ? `${baseAppName} (Preview)`
        : baseAppName;
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
      this.splashScreen = new SplashScreen(this, autoUpdater);
      await this.splashScreen.load();
      if (this.splashScreen.isDestroyed()) return null;
      this.splashScreen.close();
      this.tray = new AppTray(this);
      this.tray.create();
      this.mainWindow = new MainWindow(this, autoUpdater);
      this.tray.setMainWindow(this.mainWindow);
      await this.mainWindow.load();

      return this.mainWindow;
    } catch (error) {
      console.error('Error creating windows:', error);
      dialog.showErrorBox('Application Error', `Failed to start: ${error.message}`);
      return null;
    }
  }

  configureAppSettings() {
    const gotTheLock = app.requestSingleInstanceLock();

    if (!gotTheLock) {
      app.quit();
      return;
    }

    // Handle second instance
    app.on('second-instance', () => {
      if (this.mainWindow) {
        // Restore and focus window if minimized
        if (this.mainWindow.isMinimized()) {
          this.mainWindow.restore();
        }
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    });
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        // Keep app running in tray
      }
    });
    app.setName(this.appName);

    app.setAppUserModelId(this.appId);

    if (app.isPackaged) {
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: false,
        enabled: true,
        name: this.appName,
        serviceName: this.appName,
        type: 'app',
        path: app.getPath('exe')
      });
    }
  }

  optimizeWindows() {
    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window));
  }

  async initialize() {
    try {
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
  electronAppInstance.configureAppSettings();
  await app.whenReady();
  electronAppInstance.setupErrorHandling();
  electronAppInstance.setupAutoUpdater();

  const initialized = await electronAppInstance.initialize();
  if (!initialized) {
    console.error('Application startup failed');
    app.quit();
  }
}

launchApp();
