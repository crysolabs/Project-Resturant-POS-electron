import electron from 'electron';
import log from 'electron-log/main';
import os from 'os';

const { app, screen } = electron;

const sensitiveKeyPattern =
  /(token|password|secret|authorization|cookie|credential|api[-_]?key|card|cvv|pin|email|phone|address)/i;

export function redact(value) {
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      sensitiveKeyPattern.test(key) ? '[REDACTED]' : redact(entry)
    ])
  );
}

export function logDesktopEvent(severity, event, details = {}) {
  const payload = redact({
    timestamp: new Date().toISOString(),
    severity,
    event,
    service: 'restaurant-pos-electron',
    appVersion: app.getVersion(),
    platform: process.platform,
    ...details
  });
  if (severity === 'error' || severity === 'fatal') log.error(payload);
  else if (severity === 'warn') log.warn(payload);
  else log.info(payload);
}

export function safeDesktopDiagnostics({ appOrigin, compatibility, updateState, activeWindows = [] } = {}) {
  return redact({
    generatedAt: new Date().toISOString(),
    service: 'restaurant-pos-electron',
    appVersion: app.getVersion(),
    isPackaged: app.isPackaged,
    platform: process.platform,
    osRelease: os.release(),
    arch: process.arch,
    appOrigin,
    compatibility,
    updateState,
    displays: screen.getAllDisplays().map((display) => ({
      id: String(display.id),
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor,
      internal: display.internal
    })),
    activeWindows
  });
}
