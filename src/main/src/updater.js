import { app, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';

export default class UpdaterManager {
  constructor(main) {
    this.main = main;
    this.readyToInstall = false;
    this.lastInfo = { status: app.isPackaged ? 'idle' : 'disabled' };
  }

  configure() {
    if (!app.isPackaged) {
      this.broadcast({ status: 'disabled', reason: 'dev-mode' });
      return;
    }

    const owner = import.meta.env.MAIN_VITE_GITHUB_USERNAME;
    const repo = import.meta.env.MAIN_VITE_GITHUB_REPO;
    if (!owner || !repo) {
      this.broadcast({ status: 'disabled', reason: 'missing-github-feed' });
      return;
    }

    autoUpdater.setFeedURL({
      provider: 'github',
      owner,
      repo,
      releaseType: this.main.preview ? 'prerelease' : 'release'
    });
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => this.broadcast({ status: 'checking' }));
    autoUpdater.on('update-available', (info) =>
      this.broadcast({ status: 'available', version: info.version })
    );
    autoUpdater.on('update-not-available', (info) =>
      this.broadcast({ status: 'not-available', version: info.version || app.getVersion() })
    );
    autoUpdater.on('download-progress', (info) =>
      this.broadcast({
        status: 'downloading',
        percent: Math.round(info.percent || 0),
        transferred: info.transferred,
        total: info.total,
        bytesPerSecond: info.bytesPerSecond
      })
    );
    autoUpdater.on('update-downloaded', async (info) => {
      this.readyToInstall = true;
      this.broadcast({ status: 'downloaded', version: info.version });
      const window = this.main.mainWindow;
      if (!window || window.isDestroyed()) return;
      const result = await dialog.showMessageBox(window, {
        type: 'info',
        title: 'Update ready',
        message: 'Restaurant POS ' + info.version + ' is ready to install.',
        detail: 'Install now? The POS will restart.',
        buttons: ['Install and restart', 'Later'],
        defaultId: 0,
        cancelId: 1
      });
      if (result.response === 0) this.installUpdate();
    });
    autoUpdater.on('error', (error) =>
      this.broadcast({ status: 'error', error: error?.message || String(error) })
    );

    setTimeout(() => this.checkForUpdates().catch(() => undefined), 5000);
  }

  broadcast(info) {
    this.lastInfo = { ...this.lastInfo, ...info, checkedAt: new Date().toISOString() };
    this.main.mainWindow?.send('update-info', this.lastInfo);
  }

  async checkForUpdates() {
    if (!app.isPackaged) {
      this.broadcast({ status: 'disabled', reason: 'dev-mode' });
      return this.lastInfo;
    }
    await autoUpdater.checkForUpdates();
    return this.lastInfo;
  }

  installUpdate() {
    if (!this.readyToInstall) return { success: false, error: 'No downloaded update is ready' };
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
  }
}
