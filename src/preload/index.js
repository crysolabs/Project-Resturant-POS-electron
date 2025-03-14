import { contextBridge, ipcRenderer } from 'electron';

const electronEvents = class {
  constructor() {
    this.functions = {
      installUpdates: () => ipcRenderer.send('install-updates'),
      handleLoading: (callback) => ipcRenderer.on('loading-status', callback),
      removehandleLoading: (callback) => ipcRenderer.removeListener('loading-status', callback),
      handleUpdates: (callback) => ipcRenderer.on('update-info', callback),
      checkUpdates: () => ipcRenderer.send('check-for-updates'),
      removehandleUpdates: (callback) => ipcRenderer.removeListener('update-info', callback),
      printOrderRecepit: (data) => ipcRenderer.invoke('print-order-receipt', data),
      // seperate display manager
      focusWindow: (windowId) => ipcRenderer.invoke('focus-window', windowId),
      openWindow: (options) => ipcRenderer.invoke('open-window', options),
      getDisplayInfo: () => ipcRenderer.invoke('get-display-info'),
      closeWindow: (windowId) => ipcRenderer.invoke('close-window', windowId),
      onDisplayLoaded: (callback) => ipcRenderer.on('display-loaded', callback),
      onDisplayClosed: (callback) => ipcRenderer.on('display-closed', callback),
      removeDisplayListener: (event, callback) => ipcRenderer.removeListener(event, callback)
    };
  }

  _load() {
    try {
      contextBridge.exposeInMainWorld('electron', true);
      contextBridge.exposeInMainWorld('electronAPI', this.functions);
    } catch (error) {
      console.error(error);
    }
  }
};
new electronEvents()._load();
