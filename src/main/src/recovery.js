import { join } from 'path';
import { logDesktopEvent } from './diagnostics.js';

export const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000];
export function reconnectDelay(attempt, delays = RETRY_DELAYS) {
  return delays[Math.min(Math.max(attempt, 0), delays.length - 1)];
}

export function attachRecovery(window, getTargetUrl, options = {}) {
  let attempt = 0;
  let retryTimer = null;
  let hasLoadedApp = false;
  const showOfflineAfterFirstLoad = options.showOfflineAfterFirstLoad !== false;
  const clearRetry = () => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  };
  const retry = async (reason = 'network-unavailable') => {
    if (window.isDestroyed()) return;
    clearRetry();
    const delay = reconnectDelay(attempt++);
    logDesktopEvent('warn', 'desktop.load.retry', { reason, retryInMs: delay, attempt });
    if (!hasLoadedApp || showOfflineAfterFirstLoad) {
      try {
        await window.loadFile(join(__dirname, '../renderer/offline/index.html'), {
          query: { reason, retryIn: String(Math.ceil(delay / 1000)) }
        });
      } catch (error) {
        logDesktopEvent('error', 'desktop.load.offline_screen_failed', { error });
      }
    }
    retryTimer = setTimeout(async () => {
      if (window.isDestroyed()) return;
      try {
        await window.loadURL(getTargetUrl());
      } catch {
        retry(reason);
      }
    }, delay);
  };
  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (isMainFrame && /^https?:/.test(validatedURL))
        logDesktopEvent('warn', 'desktop.load.failed', {
          errorCode,
          errorDescription,
          origin: new URL(validatedURL).origin
        });
      if (isMainFrame && /^https?:/.test(validatedURL))
        retry(errorDescription || String(errorCode));
    }
  );
  window.webContents.on('did-finish-load', () => {
    if (/^https?:/.test(window.webContents.getURL())) {
      logDesktopEvent('info', 'desktop.load.finished', {
        origin: new URL(window.webContents.getURL()).origin
      });
      hasLoadedApp = true;
      attempt = 0;
      clearRetry();
    }
  });
  window.on('unresponsive', () => {
    logDesktopEvent('error', 'desktop.window.unresponsive', {});
    retry('window-unresponsive');
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    logDesktopEvent('error', 'desktop.renderer.gone', { reason: details.reason });
    retry(details.reason);
  });
  window.on('closed', clearRetry);
  return { retry };
}
