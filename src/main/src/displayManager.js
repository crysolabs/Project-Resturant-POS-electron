import { BrowserWindow, screen } from 'electron';
import { join } from 'path';

class DisplayManager extends BrowserWindow {
  constructor(options = {}) {
    const displays = screen.getAllDisplays();
    const targetDisplay = displays[options.displayIndex || 0];

    super({
      width: options.width || 1024,
      height: options.height || 768,
      x: targetDisplay.bounds.x,
      y: targetDisplay.bounds.y,
      autoHideMenuBar: true,
      icon: join(__dirname, '../../build/resources/icon.png'),
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        nodeIntegration: true,
        contextIsolation: true
      },
      ...options.windowOptions
    });

    this.displayIndex = options.displayIndex;
  }

  handleEvents() {
    const handleClose = () => {
      this.destroy();
    };
    this.once('close', handleClose);
  }

  async load(url) {
    this.loadURL(url);
    
    await new Promise((resolve) => {
      this.once('ready-to-show', () => {
        resolve();
      });
    });
    
    this.show();
    this.handleEvents();
  }
}

export default DisplayManager;
