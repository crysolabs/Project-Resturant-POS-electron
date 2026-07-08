import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { resolveUpdatePolicy, updateReleaseType } from './compatibility.js';
import { logDesktopEvent } from './diagnostics.js';

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const MANUAL_CHECK_THROTTLE_MS = 30 * 1000;

export default class UpdaterManager {
  constructor(main) {
    this.main = main;
    this.readyToInstall = false;
    this.checking = false;
    this.downloading = false;
    this.availableInfo = null;
    this.channel = main.updateChannel || 'stable';
    this.policy = resolveUpdatePolicy({
      currentVersion: app.getVersion(),
      minimumVersion: process.env.CRYSO_MIN_DESKTOP_VERSION,
      force: process.env.CRYSO_FORCE_DESKTOP_UPDATE === 'true'
    });
    this.lastCheckStartedAt = 0;
    this.lastInfo = {
      status: app.isPackaged ? 'idle' : 'disabled',
      version: app.getVersion(),
      channel: this.channel,
      policy: this.policy
    };
    this.interval = null;
  }

  configure() {
    if (!app.isPackaged) {
      logDesktopEvent('info', 'desktop.updater.disabled', { reason: 'dev-mode' });
      this.broadcast({ status: 'disabled', reason: 'dev-mode' });
      return;
    }

    const owner = import.meta.env.MAIN_VITE_GITHUB_USERNAME;
    const repo = import.meta.env.MAIN_VITE_GITHUB_REPO;
    if (!owner || !repo) {
      logDesktopEvent('warn', 'desktop.updater.disabled', { reason: 'missing-github-feed' });
      this.broadcast({ status: 'disabled', reason: 'missing-github-feed' });
      return;
    }

    autoUpdater.setFeedURL({
      provider: 'github',
      owner,
      repo,
      releaseType: updateReleaseType(this.channel)
    });
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      this.checking = true;
      logDesktopEvent('info', 'desktop.updater.checking', { channel: this.channel });
      this.broadcast({ status: 'checking', version: app.getVersion() });
    });
    autoUpdater.on('update-available', (info) => {
      this.checking = false;
      this.availableInfo = info;
      const policy = resolveUpdatePolicy({
        currentVersion: app.getVersion(),
        minimumVersion: info.minimumVersion || info.releaseNotes?.minimumVersion || this.policy.minimumVersion,
        force: info.force === true || info.mandatory === true || this.policy.forced
      });
      this.policy = policy;
      logDesktopEvent('info', 'desktop.updater.available', {
        version: info.version,
        channel: this.channel,
        installMode: policy.installMode
      });
      this.broadcast({ status: 'available', version: info.version, policy });
    });
    autoUpdater.on('update-not-available', (info) => {
      this.checking = false;
      this.availableInfo = null;
      logDesktopEvent('info', 'desktop.updater.not_available', {
        version: info.version || app.getVersion()
      });
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
      this.broadcast({ status: 'downloaded', version: info.version, policy: this.policy });
    });
    autoUpdater.on('error', (error) => {
      this.checking = false;
      this.downloading = false;
      logDesktopEvent('error', 'desktop.updater.error', { error });
      this.broadcast({ status: 'error', error: error?.message || String(error), recoverable: true });
    });

    setTimeout(() => this.checkForUpdates({ manual: false }).catch(() => undefined), 5000);
    this.interval = setInterval(
      () => this.checkForUpdates({ manual: false }).catch(() => undefined),
      UPDATE_CHECK_INTERVAL_MS
    );
  }

  broadcast(info) {
    this.lastInfo = {
      ...this.lastInfo,
      ...info,
      channel: this.channel,
      policy: info.policy || this.policy,
      checkedAt: new Date().toISOString()
    };
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
