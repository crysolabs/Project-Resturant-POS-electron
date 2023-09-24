import { contextBridge, ipcRenderer } from 'electron';

const electronEvents = class {
  constructor() {
    this.functions = {
      installUpdates: () => ipcRenderer.send('install-updates'),
      handleLoading: (callback) => ipcRenderer.on('loading-status', callback),
      handleUpdates: (callback) => ipcRenderer.on('update-info', callback)
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
