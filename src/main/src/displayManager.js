import { BrowserWindow, screen } from 'electron';
import { join } from 'path';
import { randomUUID } from 'crypto';
import {
  DISPLAY_ROUTE,
  appUrl,
  electronUserAgent,
  isBrowserOnlyRoute,
  isElectronRoute,
  openInBrowser
} from './navigation';

class DisplayManager extends BrowserWindow {
  constructor(site, options = {}) {
    const displays = screen.getAllDisplays();
    const targetDisplay =
      displays[options.displayIndex] ||
      displays.find((display) => !display.internal) ||
      displays[1] ||
      displays[0];
    const preloadPath = join(__dirname, '../preload/index.js');

    super({
      width: targetDisplay.bounds.width,
      height: targetDisplay.bounds.height,
      minWidth: 1024,
      minHeight: 700,
      x: targetDisplay.bounds.x,
      y: targetDisplay.bounds.y,
      title: site.main.appName,
      backgroundColor: '#f6f8fb',
      autoHideMenuBar: true,
      frame: false,
      kiosk: true,
      fullscreen: true,
      icon: site.main.appIconPath,
      show: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    this.displayId = targetDisplay.id;
    this.options = options;
    this.windowId = options.windowId || `customer-display-${randomUUID()}`;
    this.webContents.setUserAgent(electronUserAgent(this.webContents.getUserAgent()));
  }

  handleEvents() {
    this.webContents.on('will-navigate', (event, url) => {
      if (isElectronRoute(url)) return;

      event.preventDefault();
      if (isBrowserOnlyRoute(url)) {
        openInBrowser(url);
      }
    });

    this.webContents.setWindowOpenHandler(({ url }) => {
      if (isBrowserOnlyRoute(url) || !isElectronRoute(url)) {
        openInBrowser(url);
      }
      return { action: 'deny' };
    });
  }

  async load(url = appUrl(DISPLAY_ROUTE)) {
    this.handleEvents();
    await this.loadURL(isElectronRoute(url) ? url : appUrl(DISPLAY_ROUTE), {
      userAgent: electronUserAgent(this.webContents.getUserAgent())
    });

    await new Promise((resolve) => {
      this.once('ready-to-show', resolve);
    });

    this.show();
    this.setFullScreen(true);
    this.setKiosk(true);
    return this.windowId;
  }

  cleanup() {
    if (!this.isDestroyed()) {
      this.destroy();
    }
    return true;
  }
}

export default DisplayManager;
