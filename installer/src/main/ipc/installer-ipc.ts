import { BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import type { InstallOptions } from '../../shared/types';
import {
  checkRequirements,
  currentUserInstallPath,
  detectEnvironment,
  detectExistingInstallation,
  machineInstallPath,
  validateInstallPath
} from '../backend/environment';
import {
  mapErrorToUserMessage,
  openInstallLog,
  readInstallLog,
  repairInstall,
  startInstall,
  uninstallApp,
  wireProgress
} from '../backend/install-actions';

export function registerInstallerIpc(window: BrowserWindow): void {
  const sink = wireProgress(window);
  const payloadPath = join(process.resourcesPath, 'payload', 'Restaurant-POS-System-payload.exe');

  ipcMain.handle('installer:detectEnvironment', () => detectEnvironment());
  ipcMain.handle('installer:detectExistingInstallation', () => detectExistingInstallation());
  ipcMain.handle('installer:defaultPath', (_event, scope: InstallOptions['scope']) =>
    scope === 'allUsers' ? machineInstallPath() : currentUserInstallPath()
  );
  ipcMain.handle(
    'installer:validateInstallPath',
    (_event, path: string, scope: InstallOptions['scope']) => validateInstallPath(path, scope)
  );
  ipcMain.handle('installer:checkRequirements', (_event, options: InstallOptions) =>
    checkRequirements(options)
  );
  ipcMain.handle('installer:startInstall', async (_event, options: InstallOptions) => {
    try {
      await startInstall(options, payloadPath, sink);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: mapErrorToUserMessage(error) };
    }
  });
  ipcMain.handle('installer:repairInstall', async (_event, options: InstallOptions) => {
    try {
      await repairInstall(options, payloadPath, sink);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: mapErrorToUserMessage(error) };
    }
  });
  ipcMain.handle('installer:uninstallApp', async (_event, removeUserData: boolean) => {
    await uninstallApp(removeUserData, sink);
    return { ok: true };
  });
  ipcMain.handle('installer:openInstallLog', () => openInstallLog());
  ipcMain.handle('installer:readInstallLog', () => readInstallLog());
}
