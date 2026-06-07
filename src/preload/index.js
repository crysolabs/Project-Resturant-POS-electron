import { contextBridge, ipcRenderer } from 'electron';

const allowedEvents = new Set(['display-loaded', 'display-closed']);
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
    openWindow: (options = {}) => ipcRenderer.invoke('open-window', options),
    focusWindow: (options = {}) => ipcRenderer.invoke('focus-window', options),
    setFullScreen: (options = {}) => ipcRenderer.invoke('set-full-screen', options),
    onDisplayLoaded: (callback) => addListener('display-loaded', callback),
    onDisplayClosed: (callback) => addListener('display-closed', callback),
    removeDisplayListener
  })
);
