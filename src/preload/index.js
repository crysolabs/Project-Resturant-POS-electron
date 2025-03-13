import { contextBridge, ipcRenderer } from 'electron';

const electronEvents = class {
  constructor() {
    this.functions = {
      installUpdates: () => ipcRenderer.send('install-updates'),
      handleLoading: (callback) => ipcRenderer.on('loading-status', callback),
      removehandleLoading: (callback) => ipcRenderer.removeListener('loading-status', callback),
      handleUpdates: (callback) => ipcRenderer.on('update-info', callback),
      removehandleUpdates: (callback) => ipcRenderer.removeListener('update-info', callback),
      printOrderRecepit: (data) => ipcRenderer.invoke('print-order-receipt', data),
      // seperate display manager
      openWindow: (options) => ipcRenderer.invoke('open-window', options),
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
