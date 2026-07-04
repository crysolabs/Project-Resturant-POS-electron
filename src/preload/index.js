import { contextBridge, ipcRenderer } from 'electron';

const allowedEvents = new Set([
  'display-loaded',
  'display-closed',
  'update-info',
  'window-state-changed',
  'download-blocked',
  'access-state-changed'
]);
const listeners = new Map();
function addListener(eventName, callback) {
  if (!allowedEvents.has(eventName) || typeof callback !== 'function') return;
  const wrapped = (_event, payload) => callback(payload);
  listeners.set(callback, { eventName, wrapped });
  ipcRenderer.on(eventName, wrapped);
}
function removeDisplayListener(eventName, callback) {
  if (!allowedEvents.has(eventName) || typeof callback !== 'function') return;
  const listener = listeners.get(callback);
  if (!listener || listener.eventName !== eventName) return;
  ipcRenderer.removeListener(eventName, listener.wrapped);
  listeners.delete(callback);
}
contextBridge.exposeInMainWorld(
  'electronAPI',
  Object.freeze({
    getDisplayInfo: () => ipcRenderer.invoke('get-display-info'),
    getDisplayPreferences: () => ipcRenderer.invoke('get-display-preferences'),
    setDisplayPreferences: (preferences = {}) =>
      ipcRenderer.invoke('set-display-preferences', preferences),
    windowControl: (action) => ipcRenderer.invoke('window-control', { action }),
    getWindowState: () => ipcRenderer.invoke('get-window-state'),
    getAppInfo: () => ipcRenderer.invoke('get-app-info'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    openWindow: (options = {}) => ipcRenderer.invoke('open-window', options),
    focusWindow: (options = {}) => ipcRenderer.invoke('focus-window', options),
    setFullScreen: (options = {}) => ipcRenderer.invoke('set-full-screen', options),
    closeWindow: (options = {}) => ipcRenderer.invoke('close-window', options),
    onDisplayLoaded: (callback) => addListener('display-loaded', callback),
    onDisplayClosed: (callback) => addListener('display-closed', callback),
    onUpdateInfo: (callback) => addListener('update-info', callback),
    onWindowStateChanged: (callback) => addListener('window-state-changed', callback),
    onDownloadBlocked: (callback) => addListener('download-blocked', callback),
    onAccessStateChanged: (callback) => addListener('access-state-changed', callback),
    removeDisplayListener
  })
);
