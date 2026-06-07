import { contextBridge, ipcRenderer } from 'electron';

const listenerMap = new Map();
const displayEvents = new Set(['display-loaded', 'display-closed']);

function addListener(event, callback) {
  if (typeof callback !== 'function') return;

  const wrappedCallback = (_event, payload) => callback(payload);
  listenerMap.set(callback, { event, wrappedCallback });
  ipcRenderer.on(event, wrappedCallback);
}

function removeListener(event, callback) {
  if (!displayEvents.has(event)) return;

  if (typeof callback !== 'function') {
    listenerMap.forEach((listener, originalCallback) => {
      if (listener.event === event) {
        ipcRenderer.removeListener(event, listener.wrappedCallback);
        listenerMap.delete(originalCallback);
      }
    });
    return;
  }

  const listener = listenerMap.get(callback);
  if (!listener || listener.event !== event) return;

  ipcRenderer.removeListener(event, listener.wrappedCallback);
  listenerMap.delete(callback);
}

const electronAPI = {
  installUpdates: () => ipcRenderer.send('install-updates'),
  handleLoading: (callback) => addListener('loading-status', callback),
  removehandleLoading: (callback) => {
    const listener = listenerMap.get(callback);
    if (!listener || listener.event !== 'loading-status') return;
    ipcRenderer.removeListener('loading-status', listener.wrappedCallback);
    listenerMap.delete(callback);
  },
  handleUpdates: (callback) => addListener('update-info', callback),
  checkUpdates: () => ipcRenderer.send('check-for-updates'),
  removehandleUpdates: (callback) => {
    const listener = listenerMap.get(callback);
    if (!listener || listener.event !== 'update-info') return;
    ipcRenderer.removeListener('update-info', listener.wrappedCallback);
    listenerMap.delete(callback);
  },
  printOrderRecepit: (data) => ipcRenderer.invoke('print-order-receipt', data),
  openWindow: (options = {}) => ipcRenderer.invoke('open-window', options),
  focusWindow: (options = {}) => ipcRenderer.invoke('focus-window', options),
  setFullScreen: (options = {}) => ipcRenderer.invoke('set-full-screen', options),
  getDisplayInfo: () => ipcRenderer.invoke('get-display-info'),
  closeWindow: (options = {}) => ipcRenderer.invoke('close-window', options),
  onDisplayLoaded: (callback) => addListener('display-loaded', callback),
  onDisplayClosed: (callback) => addListener('display-closed', callback),
  removeDisplayListener: removeListener
};

try {
  contextBridge.exposeInMainWorld('electron', true);
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
} catch (error) {
  console.error(error);
}
