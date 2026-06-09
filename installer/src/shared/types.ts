export type InstallScope = 'currentUser' | 'allUsers';
export type InstallerMode =
  | 'fresh'
  | 'update'
  | 'repair'
  | 'reinstall'
  | 'uninstall'
  | 'changeOptions';
export type ThemeMode = 'system' | 'light' | 'dark';
export type StepStatus = 'pending' | 'active' | 'success' | 'failed';

export interface AppInfo {
  appName: string;
  appPurpose: string;
  publisherName: string;
  appId: string;
  version: string;
  updateServerUrl?: string;
  hasCli: boolean;
  supportsFileAssociations: boolean;
  supportsProtocolHandler: boolean;
}

export interface EnvironmentInfo {
  osVersion: string;
  arch: string;
  isWindows11OrNewer: boolean;
  is64Bit: boolean;
  isAdmin: boolean;
  localProgramsPath: string;
  programFilesPath: string;
  tempPath: string;
  freeBytes: number;
}

export interface ExistingInstallation {
  found: boolean;
  version?: string;
  installPath?: string;
  scope?: InstallScope;
  updateChannel?: string;
  isBroken?: boolean;
  hasDesktopShortcut?: boolean;
  hasStartMenuShortcut?: boolean;
  metadataPath?: string;
}

export interface InstallOptions {
  scope: InstallScope;
  destination: string;
  createDesktopShortcut: boolean;
  createStartMenuShortcut: boolean;
  launchAfterInstall: boolean;
  startWithWindows: boolean;
  enableAutoUpdates: boolean;
  addToPath: boolean;
  registerFileAssociations: boolean;
  registerProtocolHandler: boolean;
  sendCrashReports: boolean;
  importPreviousSettings: boolean;
}

export interface PathValidationResult {
  ok: boolean;
  normalizedPath: string;
  requiresElevation: boolean;
  isProtected: boolean;
  freeBytes: number;
  requiredBytes: number;
  message?: string;
  code?: InstallerErrorCode;
}

export type InstallerErrorCode =
  | 'UNSUPPORTED_OS'
  | 'UNSUPPORTED_ARCH'
  | 'INSUFFICIENT_DISK'
  | 'PATH_NOT_WRITABLE'
  | 'PATH_INVALID'
  | 'APP_RUNNING'
  | 'ELEVATION_REQUIRED'
  | 'PAYLOAD_MISSING'
  | 'PAYLOAD_FAILED'
  | 'ROLLBACK_FAILED'
  | 'UNKNOWN';

export interface InstallerErrorPayload {
  title: string;
  message: string;
  code: InstallerErrorCode;
  details?: string;
  actions: Array<'retry' | 'chooseFolder' | 'runAsAdmin' | 'closeApp' | 'openLog' | 'cancel'>;
}

export interface InstallStep {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

export interface ProgressEvent {
  stepId: string;
  status: StepStatus;
  message: string;
  progress?: number;
}

export interface InstallMetadata {
  appId: string;
  appName: string;
  version: string;
  installPath: string;
  scope: InstallScope;
  options: InstallOptions;
  installedAt: string;
  updateChannel: string;
}

export interface InstallPlan {
  mode: InstallerMode;
  app: AppInfo;
  environment: EnvironmentInfo;
  existing: ExistingInstallation;
  options: InstallOptions;
  requiredBytes: number;
  payloadPath: string;
}

export interface InstallerApi {
  detectEnvironment(): Promise<EnvironmentInfo>;
  detectExistingInstallation(): Promise<ExistingInstallation>;
  validateInstallPath(path: string, scope: InstallScope): Promise<PathValidationResult>;
  checkRequirements(options: InstallOptions): Promise<PathValidationResult>;
  chooseInstallScope(scope: InstallScope): Promise<InstallOptions>;
  startInstall(options: InstallOptions): Promise<void>;
  repairInstall(options: InstallOptions): Promise<void>;
  uninstallApp(removeUserData: boolean): Promise<void>;
  openInstallLog(): Promise<void>;
  readInstallLog(): Promise<string>;
  onProgress(callback: (event: ProgressEvent) => void): () => void;
}
