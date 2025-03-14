import { BrowserWindow, screen } from 'electron';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { appIconPath, appName } from '..';
class DisplayManager extends BrowserWindow {
  constructor(options = {}) {
    const displays = screen.getAllDisplays();
    const targetDisplay = displays[options.displayIndex || 0];

    super({
      width: options?.width || targetDisplay.bounds.width,
      height: options?.height || targetDisplay.bounds.height,
      x: targetDisplay.bounds.x,
      y: targetDisplay.bounds.y,
      title: appName,
      autoHideMenuBar: true,
      icon: appIconPath,
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        nodeIntegration: true,
        contextIsolation: true
      },
      ...options.windowOptions
    });
    this.displayId = targetDisplay.id;
    this.options = options;
    this.windowId = options?.windowId || Date.now().toString() + randomUUID();
  }

  handleEvents() {
    const handleClose = () => {
      this.cleanup();
    };
    this.once('close', handleClose);
  }

  async load(url) {
    if (this.options?.maximize) {
      this.maximize();
    }
    this.loadURL(url);

    await new Promise((resolve) => {
      this.once('ready-to-show', () => {
        resolve();
      });
    });

    this.show();
    this.handleEvents();
    return this.windowId;
  }
  cleanup() {
    this.close();
    this.destroy();
    return true;
  }
}

export default DisplayManager;
