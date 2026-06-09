import { contextBridge, ipcRenderer } from 'electron';
import type { InstallOptions, InstallScope, ProgressEvent } from '../shared/types';

contextBridge.exposeInMainWorld('installerApi', {
  detectEnvironment: () => ipcRenderer.invoke('installer:detectEnvironment'),
  detectExistingInstallation: () => ipcRenderer.invoke('installer:detectExistingInstallation'),
  defaultPath: (scope: InstallScope) => ipcRenderer.invoke('installer:defaultPath', scope),
  validateInstallPath: (path: string, scope: InstallScope) =>
    ipcRenderer.invoke('installer:validateInstallPath', path, scope),
  checkRequirements: (options: InstallOptions) =>
    ipcRenderer.invoke('installer:checkRequirements', options),
  startInstall: (options: InstallOptions) => ipcRenderer.invoke('installer:startInstall', options),
  repairInstall: (options: InstallOptions) =>
    ipcRenderer.invoke('installer:repairInstall', options),
  uninstallApp: (removeUserData: boolean) =>
    ipcRenderer.invoke('installer:uninstallApp', removeUserData),
  openInstallLog: () => ipcRenderer.invoke('installer:openInstallLog'),
  readInstallLog: () => ipcRenderer.invoke('installer:readInstallLog'),
  onProgress: (callback: (event: ProgressEvent) => void) => {
    const listener = (_event: unknown, payload: ProgressEvent) => callback(payload);
    ipcRenderer.on('installer:progress', listener);
    return () => ipcRenderer.removeListener('installer:progress', listener);
  }
});
