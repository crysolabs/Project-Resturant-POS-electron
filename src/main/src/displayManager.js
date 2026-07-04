import { BrowserWindow, screen } from 'electron';
import { join } from 'path';
import { POS_SESSION_PARTITION } from './config';
import { selectDisplay } from './displayUtils';
import {
  DISPLAY_ROUTE,
  appUrl,
  electronUserAgent,
  isBrowserOnlyRoute,
  isElectronRoute,
  openInBrowser
} from './navigation';
import { attachRecovery } from './recovery';
import { logDesktopEvent } from './diagnostics.js';

export default class DisplayManager extends BrowserWindow {
  constructor(site, options) {
    const target = selectDisplay(
      screen.getAllDisplays(),
      options.displayId,
      site.preferences.get('customerDisplayId')
    );
    if (!target) {
      logDesktopEvent('error', 'desktop.display.unavailable', {
        requestedDisplayId: options.displayId
      });
      throw new Error('No connected display is available');
    }
    super({
      width: target.bounds.width,
      height: target.bounds.height,
      x: target.bounds.x,
      y: target.bounds.y,
      title: site.main.appName,
      backgroundColor: '#f6f8fb',
      autoHideMenuBar: true,
      frame: false,
      fullscreen: false,
      kiosk: false,
      icon: site.main.appIconPath,
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        partition: POS_SESSION_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    this.windowId = options.windowId;
    this.displayId = String(target.id);
    this.targetUrl = appUrl(DISPLAY_ROUTE);
    this.kioskEnabled = options.kiosk;
    this.webContents.setUserAgent(electronUserAgent(this.webContents.getUserAgent()));
    attachRecovery(this, () => this.targetUrl);
    this.configureNavigation();
  }
  configureNavigation() {
    this.webContents.on('will-navigate', (event, url) => {
      if (isElectronRoute(url)) return;
      event.preventDefault();
      if (isBrowserOnlyRoute(url)) openInBrowser(url);
    });
    this.webContents.setWindowOpenHandler(({ url }) => {
      if (isBrowserOnlyRoute(url) || !isElectronRoute(url)) openInBrowser(url);
      return { action: 'deny' };
    });
  }
  async load() {
    try {
      await this.loadURL(this.targetUrl);
    } catch (error) {
      logDesktopEvent('warn', 'desktop.display.load_failed', {
        windowId: this.windowId,
        displayId: this.displayId,
        error
      });
      /* recovery handler owns retry */
    }
    this.show();
    this.setDisplayMode(true, this.kioskEnabled);
    return this.windowId;
  }
  placeOn(display) {
    const kioskEnabled = this.kioskEnabled;
    this.displayId = String(display.id);
    this.setDisplayMode(false, false);
    this.setBounds(display.bounds, false);
    this.setDisplayMode(true, kioskEnabled);
  }
  setDisplayMode(fullscreen, kiosk = fullscreen) {
    this.kioskEnabled = kiosk;
    if (kiosk) {
      this.setKiosk(true);
      return;
    }
    if (this.isKiosk()) this.setKiosk(false);
    this.setFullScreen(fullscreen);
  }
  cleanup() {
    if (!this.isDestroyed()) this.destroy();
  }
}
