import type {
  InstallOptions,
  InstallStep,
  InstallerErrorPayload,
  InstallerMode
} from '../../shared/types';

export type Screen =
  | 'preparing'
  | 'welcome'
  | 'existing'
  | 'scope'
  | 'destination'
  | 'options'
  | 'review'
  | 'installing'
  | 'success'
  | 'error';

export interface InstallerState {
  screen: Screen;
  mode: InstallerMode;
  options: InstallOptions;
  advancedOpen: boolean;
  progress: number;
  steps: InstallStep[];
  error?: InstallerErrorPayload;
  existingVersion?: string;
}

export const defaultSteps: InstallStep[] = [
  { id: 'checking-system', label: 'Checking system', status: 'pending' },
  { id: 'closing-app', label: 'Closing running app', status: 'pending' },
  { id: 'backup', label: 'Backing up previous version', status: 'pending' },
  { id: 'copying-files', label: 'Copying files', status: 'pending' },
  { id: 'shortcuts', label: 'Creating shortcuts', status: 'pending' },
  { id: 'registering', label: 'Registering app', status: 'pending' },
  { id: 'updates', label: 'Configuring updates', status: 'pending' },
  { id: 'cleanup', label: 'Cleaning up', status: 'pending' }
];

export function makeInitialState(destination: string): InstallerState {
  return {
    screen: 'preparing',
    mode: 'fresh',
    advancedOpen: false,
    progress: 0,
    steps: defaultSteps,
    options: {
      scope: 'currentUser',
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
    }
  };
}

export function updateStep(
  steps: InstallStep[],
  id: string,
  status: InstallStep['status'],
  detail?: string
): InstallStep[] {
  return steps.map((step) => (step.id === id ? { ...step, status, detail } : step));
}
