import { Tray, Menu, app, nativeImage, BrowserWindow } from 'electron';
import { join } from 'path';
import packageJson from '../../../package.json';
import siteWindow from './site';

class AppTray {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.tray = null;
    this.contextMenu = null;
    this.isQuitting = false;
    this.appName = packageJson.name || 'Restaurant POS';
    this.appDescription =
      packageJson.description || 'Application is still running in the system tray';
  }

  create() {
    // Create tray icon
    const iconPath = join(__dirname, '../../build/resources/icon.png');
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

    this.tray = new Tray(trayIcon);
    this.tray.setToolTip(this.appName);

    // Create context menu
    this.updateContextMenu();

    // Add click handler to show/hide the main window
    this.tray.on('click', () => {
      this.toggleMainWindow();
    });

    // Setup the close-to-tray behavior
    this.setupCloseToTray();

    return this.tray;
  }

  setupCloseToTray() {
    // Override the close event to minimize to tray instead of quitting
    app.on('before-quit', () => {
      this.isQuitting = true;
    });

    // For all windows, intercept close event
    app.on('browser-window-created', (_, window) => {
      window.on('close', (event) => {
        // If it's not an explicit quit and it's the main window
        if (!this.isQuitting && window === this.mainWindow) {
          event.preventDefault();
          window.hide();

          // Optional: Show notification that app is still running in tray
          if (process.platform === 'win32') {
            this.tray.displayBalloon({
              title: this.appName,
              content: this.appDescription
            });
          }
          return false;
        }
      });
    });
    const gotTheLock = app.requestSingleInstanceLock();

    if (!gotTheLock) {
      app.quit();
    } else {
      app.on('second-instance', () => {
        // Someone tried to run a second instance, focus our window instead
        if (this.mainWindow) {
          if (this.mainWindow.isMinimized()) {
            this.mainWindow.restore();
          }
          this.mainWindow.show();
          this.mainWindow.focus();
        }
      });
    }
  }

  toggleMainWindow() {
    if (!this.mainWindow) return;

    // Check if isVisible is a function before calling it
    if (this.mainWindow instanceof siteWindow) {
      if (this.mainWindow.isVisible()) {
        this.mainWindow.hide();
      } else {
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    } else {
      // Fallback if isVisible is not available
      try {
        this.mainWindow.show();
        this.mainWindow.focus();
      } catch (error) {
        console.error('Error toggling window visibility:', error);
      }
    }
  }

  updateContextMenu() {
    let isWindowVisible = false;

    // Safely check if the window is visible
    if (this.mainWindow && this.mainWindow instanceof siteWindow) {
      isWindowVisible = this.mainWindow.isVisible();
    }

    this.contextMenu = Menu.buildFromTemplate([
      {
        label: isWindowVisible ? 'Hide' : 'Show',
        click: () => this.toggleMainWindow()
      },
      {
        label: 'Check for Updates',
        click: () => {
          if (this.mainWindow && this.mainWindow instanceof siteWindow) {
            this.mainWindow.checkUpdates();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          this.isQuitting = true;
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(this.contextMenu);
  }

  setMainWindow(window) {
    this.mainWindow = window;

    // Only update context menu if window is properly initialized
    if (this.mainWindow && this.mainWindow instanceof siteWindow) {
      this.updateContextMenu();

      // Update context menu when window visibility changes
      this.mainWindow.on('show', () => this.updateContextMenu());
      this.mainWindow.on('hide', () => this.updateContextMenu());
    } else {
      console.warn('Warning: Main window not properly initialized in AppTray');
      // Still update the context menu with default values
      this.updateContextMenu();
    }
  }

  destroy() {
    if (this.mainWindow && this.mainWindow instanceof siteWindow) {
      this.mainWindow.cleanup();
    }
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

export default AppTray;
