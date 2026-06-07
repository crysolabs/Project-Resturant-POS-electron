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

export default class DisplayManager extends BrowserWindow {
  constructor(site, options) {
    const target = selectDisplay(
      screen.getAllDisplays(),
      options.displayId,
      site.preferences.get('customerDisplayId')
    );
    if (!target) throw new Error('No connected display is available');
    super({
      width: target.bounds.width,
      height: target.bounds.height,
      x: target.bounds.x,
      y: target.bounds.y,
      title: site.main.appName,
      backgroundColor: '#f6f8fb',
      autoHideMenuBar: true,
      frame: false,
      fullscreen: options.fullscreen,
      kiosk: options.kiosk,
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
    } catch {
      /* recovery handler owns retry */
    }
    this.show();
    return this.windowId;
  }
  placeOn(display) {
    this.displayId = String(display.id);
    this.setBounds(display.bounds);
    if (this.isFullScreen()) this.setFullScreen(true);
    if (this.kioskEnabled) this.setKiosk(true);
  }
  setDisplayMode(fullscreen, kiosk = fullscreen) {
    this.kioskEnabled = kiosk;
    this.setFullScreen(fullscreen);
    this.setKiosk(kiosk);
  }
  cleanup() {
    if (!this.isDestroyed()) this.destroy();
  }
}
