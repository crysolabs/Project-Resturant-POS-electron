import type { InstallerApi } from '../../shared/types';

declare global {
  interface Window {
    installerApi: InstallerApi & { defaultPath(scope: 'currentUser' | 'allUsers'): Promise<string> };
  }
}

export {};
