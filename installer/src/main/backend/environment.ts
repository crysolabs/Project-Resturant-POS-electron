import { app } from 'electron';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join, normalize, parse } from 'node:path';
import { arch, release, tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  AppInfo,
  EnvironmentInfo,
  ExistingInstallation,
  InstallMetadata,
  InstallOptions,
  InstallScope,
  PathValidationResult
} from '../../shared/types';

const execFileAsync = promisify(execFile);
const requiredBytes = 650 * 1024 * 1024;

export const appInfo: AppInfo = {
  appName: 'Restaurant POS System',
  appPurpose: 'restaurant sales, kitchen display, inventory, and customer display workflows',
  publisherName: 'CrysoLabs',
  appId: 'com.achiraGaming.resuturant-pos-system',
  version: app.getVersion(),
  updateServerUrl: 'https://resutrant-pos.crysolabs.com',
  hasCli: false,
  supportsFileAssociations: false,
  supportsProtocolHandler: false
};

export function currentUserInstallPath(): string {
  return join(app.getPath('home'), 'AppData', 'Local', 'Programs', appInfo.appName);
}

export function machineInstallPath(): string {
  return join(process.env.ProgramFiles || 'C:\\Program Files', appInfo.appName);
}

export function metadataPath(scope: InstallScope): string {
  const base =
    scope === 'allUsers'
      ? process.env.ProgramData || 'C:\\ProgramData'
      : app.getPath('localAppData');
  return join(base, appInfo.appName, 'install-metadata.json');
}

export function installLogPath(scope: InstallScope = 'currentUser'): string {
  const base =
    scope === 'allUsers'
      ? process.env.ProgramData || 'C:\\ProgramData'
      : app.getPath('localAppData');
  return join(base, appInfo.appName, 'logs', 'installer.log');
}

export async function isAdmin(): Promise<boolean> {
  try {
    await execFileAsync('net', ['session'], { windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

async function getFreeBytes(targetPath: string): Promise<number> {
  const root = parse(normalize(targetPath)).root.replace(/\\$/, '');
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `(Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='${root}'").FreeSpace`
      ],
      { windowsHide: true }
    );
    return Number(stdout.trim()) || 0;
  } catch {
    return 0;
  }
}

export async function detectEnvironment(): Promise<EnvironmentInfo> {
  const osVersion = release();
  const freeBytes = await getFreeBytes(currentUserInstallPath());
  const major = Number(osVersion.split('.')[0] || '0');
  const build = Number(osVersion.split('.')[2] || '0');
  return {
    osVersion,
    arch: arch(),
    isWindows11OrNewer: major > 10 || (major === 10 && build >= 22000),
    is64Bit: process.arch === 'x64' || process.arch === 'arm64',
    isAdmin: await isAdmin(),
    localProgramsPath: currentUserInstallPath(),
    programFilesPath: machineInstallPath(),
    tempPath: tmpdir(),
    freeBytes
  };
}

export async function detectExistingInstallation(): Promise<ExistingInstallation> {
  for (const scope of ['currentUser', 'allUsers'] as const) {
    try {
      const path = metadataPath(scope);
      const raw = await readFile(path, 'utf8');
      const metadata = JSON.parse(raw) as InstallMetadata;
      return {
        found: true,
        version: metadata.version,
        installPath: metadata.installPath,
        scope: metadata.scope,
        updateChannel: metadata.updateChannel,
        metadataPath: path,
        isBroken: !(await canAccess(join(metadata.installPath, `${appInfo.appName}.exe`))),
        hasDesktopShortcut: metadata.options.createDesktopShortcut,
        hasStartMenuShortcut: metadata.options.createStartMenuShortcut
      };
    } catch {
      // Try the next scope.
    }
  }
  return { found: false };
}

export async function validateInstallPath(
  path: string,
  scope: InstallScope
): Promise<PathValidationResult> {
  const normalizedPath = normalize(path.trim());
  const isProtected = normalizedPath
    .toLowerCase()
    .startsWith((process.env.ProgramFiles || 'C:\\Program Files').toLowerCase());
  const freeBytes = await getFreeBytes(normalizedPath);

  if (!normalizedPath || /[<>"|?*]/.test(normalizedPath)) {
    return failPath(
      normalizedPath,
      freeBytes,
      'PATH_INVALID',
      'This folder name is not valid. Choose another folder.'
    );
  }

  if (/^\\\\/.test(normalizedPath)) {
    return failPath(
      normalizedPath,
      freeBytes,
      'PATH_INVALID',
      'Network folders are not supported for this installer. Choose a local folder.'
    );
  }

  if (freeBytes < requiredBytes) {
    return failPath(
      normalizedPath,
      freeBytes,
      'INSUFFICIENT_DISK',
      'There is not enough free space on this drive.'
    );
  }

  if ((scope === 'allUsers' || isProtected) && !(await isAdmin())) {
    return {
      ok: false,
      normalizedPath,
      requiresElevation: true,
      isProtected,
      freeBytes,
      requiredBytes,
      code: 'ELEVATION_REQUIRED',
      message:
        'Windows will ask for permission because this installs for all users or into a protected folder.'
    };
  }

  try {
    await mkdir(normalizedPath, { recursive: true });
    await access(normalizedPath, constants.W_OK);
  } catch {
    return failPath(
      normalizedPath,
      freeBytes,
      'PATH_NOT_WRITABLE',
      'This folder does not allow writing. Choose another folder or install as administrator.'
    );
  }

  return {
    ok: true,
    normalizedPath,
    requiresElevation: false,
    isProtected,
    freeBytes,
    requiredBytes
  };
}

export async function checkRequirements(options: InstallOptions): Promise<PathValidationResult> {
  const env = await detectEnvironment();
  if (!env.isWindows11OrNewer) {
    return failPath(
      options.destination,
      env.freeBytes,
      'UNSUPPORTED_OS',
      'This version needs Windows 11 or a supported Windows 10 build.'
    );
  }
  if (!env.is64Bit) {
    return failPath(
      options.destination,
      env.freeBytes,
      'UNSUPPORTED_ARCH',
      'This installer needs a 64-bit Windows device.'
    );
  }
  return validateInstallPath(options.destination, options.scope);
}

export async function writeInstallMetadata(options: InstallOptions): Promise<void> {
  const metadata: InstallMetadata = {
    appId: appInfo.appId,
    appName: appInfo.appName,
    version: appInfo.version,
    installPath: options.destination,
    scope: options.scope,
    options,
    installedAt: new Date().toISOString(),
    updateChannel: 'stable'
  };
  const target = metadataPath(options.scope);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(metadata, null, 2), 'utf8');
}

async function canAccess(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function failPath(
  normalizedPath: string,
  freeBytes: number,
  code: PathValidationResult['code'],
  message: string
): PathValidationResult {
  return {
    ok: false,
    normalizedPath,
    requiresElevation: false,
    isProtected: false,
    freeBytes,
    requiredBytes,
    code,
    message
  };
}
