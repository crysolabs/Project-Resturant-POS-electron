import { app } from 'electron';
import { autoUpdater } from 'electron-updater';

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const MANUAL_CHECK_THROTTLE_MS = 30 * 1000;

export default class UpdaterManager {
  constructor(main) {
    this.main = main;
    this.readyToInstall = false;
    this.checking = false;
    this.downloading = false;
    this.availableInfo = null;
    this.lastCheckStartedAt = 0;
    this.lastInfo = { status: app.isPackaged ? 'idle' : 'disabled', version: app.getVersion() };
    this.interval = null;
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
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      this.checking = true;
      this.broadcast({ status: 'checking', version: app.getVersion() });
    });
    autoUpdater.on('update-available', (info) => {
      this.checking = false;
      this.availableInfo = info;
      this.broadcast({ status: 'available', version: info.version });
    });
    autoUpdater.on('update-not-available', (info) => {
      this.checking = false;
      this.availableInfo = null;
      this.broadcast({ status: 'not-available', version: info.version || app.getVersion() });
    });
    autoUpdater.on('download-progress', (info) =>
      this.broadcast({
        status: 'downloading',
        percent: Math.round(info.percent || 0),
        transferred: info.transferred,
        total: info.total,
        bytesPerSecond: info.bytesPerSecond
      })
    );
    autoUpdater.on('update-downloaded', (info) => {
      this.readyToInstall = true;
      this.downloading = false;
      this.broadcast({ status: 'downloaded', version: info.version });
    });
    autoUpdater.on('error', (error) => {
      this.checking = false;
      this.downloading = false;
      this.broadcast({ status: 'error', error: error?.message || String(error) });
    });

    setTimeout(() => this.checkForUpdates({ manual: false }).catch(() => undefined), 5000);
    this.interval = setInterval(
      () => this.checkForUpdates({ manual: false }).catch(() => undefined),
      UPDATE_CHECK_INTERVAL_MS
    );
  }

  broadcast(info) {
    this.lastInfo = { ...this.lastInfo, ...info, checkedAt: new Date().toISOString() };
    this.main.mainWindow?.send('update-info', this.lastInfo);
  }

  async checkForUpdates({ manual = false } = {}) {
    if (!app.isPackaged) {
      this.broadcast({ status: 'disabled', reason: 'dev-mode' });
      return this.lastInfo;
    }
    if (this.readyToInstall) return this.lastInfo;
    if (this.checking || this.downloading) return this.lastInfo;
    const now = Date.now();
    if (manual && now - this.lastCheckStartedAt < MANUAL_CHECK_THROTTLE_MS) return this.lastInfo;
    this.lastCheckStartedAt = now;
    await autoUpdater.checkForUpdates();
    return this.lastInfo;
  }

  async downloadUpdate() {
    if (!app.isPackaged) {
      this.broadcast({ status: 'disabled', reason: 'dev-mode' });
      return this.lastInfo;
    }
    if (this.readyToInstall || this.downloading) return this.lastInfo;
    if (!this.availableInfo) {
      await this.checkForUpdates({ manual: true });
      if (!this.availableInfo) return this.lastInfo;
    }
    this.downloading = true;
    this.broadcast({ status: 'downloading', version: this.availableInfo.version, percent: 0 });
    await autoUpdater.downloadUpdate();
    return this.lastInfo;
  }

  installUpdate() {
    if (!this.readyToInstall) return { success: false, error: 'No downloaded update is ready' };
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
  }
}
