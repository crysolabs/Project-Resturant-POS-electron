import { app, BrowserWindow, nativeTheme } from 'electron';
import { join } from 'node:path';
import { registerInstallerIpc } from './ipc/installer-ipc';

function createWindow(): void {
  const window = new BrowserWindow({
    width: 760,
    height: 560,
    minWidth: 680,
    minHeight: 500,
    show: false,
    autoHideMenuBar: true,
    title: 'Restaurant POS System Setup',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#111827' : '#f6f8fb',
    titleBarStyle: 'default',
    icon: join(__dirname, '../../assets/icon.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  registerInstallerIpc(window);

  if (process.env.ELECTRON_INSTALLER_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_INSTALLER_RENDERER_URL);
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  window.once('ready-to-show', () => window.show());
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
