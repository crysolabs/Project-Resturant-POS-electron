// main.js
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { autoUpdater } from 'electron-updater';
import { join } from 'path';
import siteWindow from './src/site';
import loaderWindow from './src/loader';
import AppTray from './src/tray';
import packageJson from '../../package.json';

// Global references to prevent garbage collection
let loaderWindowInstance = null;
let siteWindowInstance = null;
let tray = null;

/**
 * Configure auto updater settings
 */
function setupAutoUpdater() {
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

    // Handle auto updater errors
    autoUpdater.on('error', (error) => {
      console.error('Auto updater error:', error);
    });

    return true;
  } catch (error) {
    console.error('Failed to setup auto updater:', error);
    return false;
  }
}

/**
 * Create the main application window
 * @returns {Promise<BrowserWindow|null>} The created window or null on error
 */
async function createMainWindow() {
  try {
    // Create loader window
    loaderWindowInstance = new loaderWindow(siteWindow, autoUpdater);
    await loaderWindowInstance.load();

    // Get site window instance
    siteWindowInstance = loaderWindowInstance.siteWindowInstance;

    // Set the main window in the tray
    if (tray && siteWindowInstance) {
      tray.setMainWindow(siteWindowInstance);
    }

    return siteWindowInstance;
  } catch (error) {
    console.error('Error creating main window:', error);
    dialog.showErrorBox('Application Error', `Failed to start application: ${error.message}`);
    return null;
  }
}

/**
 * Initialize the application
 */
async function initApp() {
  try {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron');
    app.setLoginItemSettings({
      openAtLogin: true, // Start on boot
      openAsHidden: true, // Start minimized
      path: app.getPath('exe') // Path to the executable
    });
    // Optimize renderer process
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    // Create system tray
    tray = new AppTray();
    tray.create();

    // Create main window
    const mainWindow = await createMainWindow();

    if (!mainWindow) {
      throw new Error('Failed to create main window');
    }

    // Handle macOS activate event
    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createMainWindow();
      } else if (siteWindowInstance && !siteWindowInstance.isVisible()) {
        siteWindowInstance.show();
      }
    });

    return true;
  } catch (error) {
    console.error('Failed to initialize app:', error);
    return false;
  }
}

// App ready event
app.whenReady().then(async () => {
  // Set up error handling for uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    dialog.showErrorBox('Unexpected Error', `An unexpected error occurred: ${error.message}`);
  });

  // Setup auto updater
  setupAutoUpdater();

  // Initialize app
  const success = await initApp();

  if (!success) {
    console.error('Application initialization failed');
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // On macOS it's common to keep the app running even when all windows are closed
  if (process.platform !== 'darwin') {
    // Don't quit - the tray will handle this
  }
});
