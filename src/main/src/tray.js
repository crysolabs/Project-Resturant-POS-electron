import { Tray, Menu, app, nativeImage, BrowserWindow } from 'electron';
import { join } from 'path';
import siteWindow from './site';

class AppTray {
  constructor(main) {
    this.main = main;
    this.tray = null;
    this.contextMenu = null;
    this.mainWindow = null;
    this.isQuitting = false;
    this.appName = main.appName;
    this.appDescription = main.appDescription;
    this.trayIcon = nativeImage
      .createFromPath(main.appIconPath)
      .resize({ width: 16, height: 16, quality: 'best' });
  }

  create() {
    // Create tray icon

    this.tray = new Tray(this.trayIcon);
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
              icon: this.trayIcon,
              title: this.appName,
              content: this.appDescription
            });
          }
          return false;
        }
      });
    });
  }

  toggleMainWindow() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.log('Window reference is invalid or destroyed');
      return;
    }

    try {
      if (this.mainWindow instanceof siteWindow) {
        if (this.mainWindow.isVisible()) {
          this.mainWindow.hide();
        } else {
          this.mainWindow.show();
          this.mainWindow.focus();
        }
      } else {
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    } catch (error) {
      console.error('Error handling window visibility:', error);
    }
  }

  updateContextMenu() {
    if (!this.tray || this.tray.isDestroyed()) {
      return;
    }
    let isWindowVisible = false;

    // Safely check if the window is visible
    if (
      this.mainWindow &&
      !this.mainWindow.isDestroyed() &&
      this.mainWindow instanceof siteWindow
    ) {
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
    try {
      if (
        this.mainWindow &&
        !this.mainWindow.isDestroyed() &&
        this.mainWindow instanceof siteWindow
      ) {
        this.mainWindow.cleanup();
      }
      if (this.tray && !this.tray.isDestroyed()) {
        this.tray.destroy();
        this.tray = null;
      }
    } catch (error) {
      console.error('Error during tray cleanup:', error);
    }
  }
}

export default AppTray;
