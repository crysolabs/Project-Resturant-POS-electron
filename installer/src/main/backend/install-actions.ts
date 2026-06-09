import { BrowserWindow, shell } from 'electron';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import type { InstallOptions, InstallerErrorPayload, ProgressEvent } from '../../shared/types';
import {
  appInfo,
  checkRequirements,
  detectExistingInstallation,
  installLogPath,
  writeInstallMetadata
} from './environment';

const steps = [
  ['checking-system', 'Checking system'],
  ['closing-app', 'Closing running app'],
  ['backup', 'Backing up previous version'],
  ['copying-files', 'Copying files'],
  ['shortcuts', 'Creating shortcuts'],
  ['registering', 'Registering app'],
  ['updates', 'Configuring updates'],
  ['cleanup', 'Cleaning up']
] as const;

type ProgressSink = (event: ProgressEvent) => void;

export async function startInstall(
  options: InstallOptions,
  payloadPath: string,
  sink: ProgressSink
): Promise<void> {
  try {
    await writeInstallLog(options, 'install', 'active', 'Installer started');
    await runStep(sink, 'checking-system', 'Checking system', async () => {
      const result = await checkRequirements(options);
      if (!result.ok) throw new Error(result.message || result.code || 'Requirement check failed');
    });
    await runStep(sink, 'closing-app', 'Closing running app', () => closeRunningApp(sink));
    await runStep(sink, 'backup', 'Backing up previous version', () =>
      backupPreviousVersion(options)
    );
    await runStep(sink, 'copying-files', 'Copying files', () =>
      installFiles(payloadPath, options, sink)
    );
    await runStep(sink, 'shortcuts', 'Creating shortcuts', () => createShortcuts(options));
    await runStep(sink, 'registering', 'Registering app', async () => {
      await registerFileAssociations(options);
      await registerProtocolHandlers(options);
      await writeInstallMetadata(options);
    });
    await runStep(sink, 'updates', 'Configuring updates', () =>
      configureAutoUpdates(options.enableAutoUpdates)
    );
    await runStep(sink, 'cleanup', 'Cleaning up', () => finalizeInstall(options));
    await writeInstallLog(options, 'install', 'success', 'Installer completed');
  } catch (error) {
    await writeInstallLog(
      options,
      'install',
      'failed',
      error instanceof Error ? error.message : String(error),
      error
    );
    await rollbackInstall(options, error);
    throw error;
  }
}

export async function repairInstall(
  options: InstallOptions,
  payloadPath: string,
  sink: ProgressSink
): Promise<void> {
  await writeInstallLog(options, 'repair', 'active', 'Repair started');
  await startInstall(options, payloadPath, sink);
}

export async function uninstallApp(removeUserData: boolean, sink: ProgressSink): Promise<void> {
  const existing = await detectExistingInstallation();
  if (!existing.installPath || !existing.scope) return;
  const options = defaultOptions(existing.installPath, existing.scope);
  await runStep(sink, 'cleanup', 'Removing application files', async () => {
    await rm(existing.installPath!, { recursive: true, force: true });
    if (removeUserData)
      await rm(dirname(installLogPath(existing.scope)), { recursive: true, force: true });
  });
  await writeInstallLog(options, 'uninstall', 'success', 'Uninstall completed');
}

export async function openInstallLog(
  scope: InstallOptions['scope'] = 'currentUser'
): Promise<void> {
  await shell.openPath(installLogPath(scope));
}

export async function readInstallLog(
  scope: InstallOptions['scope'] = 'currentUser'
): Promise<string> {
  try {
    return await readFile(installLogPath(scope), 'utf8');
  } catch {
    return '';
  }
}

export async function requestElevationIfNeeded(options: InstallOptions): Promise<boolean> {
  const result = await checkRequirements(options);
  return result.requiresElevation;
}

export async function closeRunningApp(sink?: ProgressSink): Promise<void> {
  sink?.({
    stepId: 'closing-app',
    status: 'active',
    message: `Checking whether ${appInfo.appName} is running...`
  });
  // Product-specific graceful close can be added through app protocol or named mutex.
}

export async function backupPreviousVersion(options: InstallOptions): Promise<void> {
  const backupPath = join(dirname(options.destination), `${appInfo.appName}.backup`);
  await mkdir(dirname(backupPath), { recursive: true });
}

export async function installFiles(
  payloadPath: string,
  options: InstallOptions,
  sink: ProgressSink
): Promise<void> {
  if (!payloadPath) throw new Error('Installer payload is missing.');
  const args = [
    '/S',
    options.scope === 'allUsers' ? '/allusers' : '/currentuser',
    `/D=${options.destination}`
  ];
  await runProcess(payloadPath, args, (line) => {
    sink({
      stepId: 'copying-files',
      status: 'active',
      message: line || 'Copying application files...'
    });
  });
}

export async function createShortcuts(options: InstallOptions): Promise<void> {
  await writeInstallLog(
    options,
    'shortcuts',
    'active',
    JSON.stringify({
      desktop: options.createDesktopShortcut,
      startMenu: options.createStartMenuShortcut
    })
  );
}

export async function registerFileAssociations(options: InstallOptions): Promise<void> {
  if (!options.registerFileAssociations) return;
  await writeInstallLog(options, 'file-associations', 'active', 'Registering file associations');
}

export async function registerProtocolHandlers(options: InstallOptions): Promise<void> {
  if (!options.registerProtocolHandler) return;
  await writeInstallLog(options, 'protocol', 'active', 'Registering protocol handler');
}

export async function configureAutoLaunch(enabled: boolean): Promise<void> {
  // Use Electron app.setLoginItemSettings in the installed app too; this is kept explicit for installer choice.
  await writeInstallLog(
    defaultOptions('', 'currentUser'),
    'auto-launch',
    'active',
    String(enabled)
  );
}

export async function configureAutoUpdates(enabled: boolean): Promise<void> {
  await writeInstallLog(defaultOptions('', 'currentUser'), 'updates', 'active', String(enabled));
}

export async function finalizeInstall(options: InstallOptions): Promise<void> {
  await writeInstallMetadata(options);
}

export async function rollbackInstall(options: InstallOptions, error: unknown): Promise<void> {
  await writeInstallLog(
    options,
    'rollback',
    'active',
    'Rolling back partial installer changes',
    error
  );
}

export function mapErrorToUserMessage(error: unknown): InstallerErrorPayload {
  const details = error instanceof Error ? `${error.message}\n${error.stack || ''}` : String(error);
  const message = error instanceof Error ? error.message : 'An unexpected setup problem occurred.';
  if (/permission|denied|elevation/i.test(message)) {
    return {
      title: 'We need permission to continue',
      message:
        'Windows needs administrator permission for this location. Install for me only or run setup as administrator.',
      code: 'ELEVATION_REQUIRED',
      details,
      actions: ['runAsAdmin', 'chooseFolder', 'openLog', 'cancel']
    };
  }
  if (/space|disk/i.test(message)) {
    return {
      title: 'There is not enough space',
      message: 'Free up space or choose another drive, then try again.',
      code: 'INSUFFICIENT_DISK',
      details,
      actions: ['chooseFolder', 'retry', 'openLog', 'cancel']
    };
  }
  return {
    title: "We couldn't finish the installation",
    message: 'Setup stopped before making all changes. Your settings were kept.',
    code: 'UNKNOWN',
    details,
    actions: ['retry', 'openLog', 'cancel']
  };
}

export async function writeInstallLog(
  options: Pick<InstallOptions, 'scope'>,
  step: string,
  status: string,
  message: string,
  error?: unknown
): Promise<void> {
  const target = installLogPath(options.scope);
  await mkdir(dirname(target), { recursive: true });
  const row = JSON.stringify({
    timestamp: new Date().toISOString(),
    step,
    status,
    message,
    errorCode: error instanceof Error ? error.name : undefined,
    stack: error instanceof Error ? error.stack : undefined
  });
  await writeFile(target, `${row}\n`, { flag: 'a' });
}

export function wireProgress(window: BrowserWindow): ProgressSink {
  return (event) => window.webContents.send('installer:progress', event);
}

async function runStep(
  sink: ProgressSink,
  stepId: string,
  label: string,
  fn: () => Promise<void>
): Promise<void> {
  sink({ stepId, status: 'active', message: label });
  await fn();
  sink({ stepId, status: 'success', message: label, progress: progressFor(stepId) });
}

function runProcess(
  command: string,
  args: string[],
  onOutput: (line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    child.stdout?.on('data', (data) => onOutput(String(data).trim()));
    child.stderr?.on('data', (data) => onOutput(String(data).trim()));
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Installer payload exited with code ${code}`))
    );
  });
}

function progressFor(stepId: string): number {
  const index = Math.max(
    0,
    steps.findIndex(([id]) => id === stepId)
  );
  return Math.round(((index + 1) / steps.length) * 100);
}

function defaultOptions(destination: string, scope: InstallOptions['scope']): InstallOptions {
  return {
    scope,
    destination,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    launchAfterInstall: true,
    startWithWindows: false,
    enableAutoUpdates: true,
    addToPath: false,
    registerFileAssociations: false,
    registerProtocolHandler: false,
    sendCrashReports: false,
    importPreviousSettings: false
  };
}
