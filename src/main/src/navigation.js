import { shell } from 'electron';

const appBaseUrl = new URL(import.meta.env.MAIN_VITE_APPURI);

export const APP_ORIGIN = appBaseUrl.origin;
export const ELECTRON_USER_AGENT_TOKEN = 'CRYSO-Electron Electron';
export const DEFAULT_ROUTE = '/login';
export const DISPLAY_ROUTE = '/pos/display';

const electronRoutes = new Set([
  '/login',
  '/forgot-password',
  '/reset-password',
  '/pos',
  '/pos/dashboard',
  '/pos/kitchen',
  '/pos/inventory',
  '/pos/menu',
  '/pos/reports',
  '/pos/settings',
  '/pos/display'
]);

const browserOnlyRoutes = new Set([
  '/platform/account',
  '/platform/billing',
  '/platform/downloads',
  '/platform/team',
  '/platform/settings',
  '/platform/menu'
]);

export function appUrl(pathname = DEFAULT_ROUTE) {
  return new URL(pathname, APP_ORIGIN).toString();
}

export function electronUserAgent(currentUserAgent = '') {
  const token = `${ELECTRON_USER_AGENT_TOKEN}/${process.versions.electron}`;
  return currentUserAgent.includes(ELECTRON_USER_AGENT_TOKEN)
    ? currentUserAgent
    : `${currentUserAgent} ${token}`.trim();
}

export function toAppUrl(value = DEFAULT_ROUTE) {
  return new URL(value, APP_ORIGIN);
}

export function isAppOrigin(url) {
  try {
    return new URL(url).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

export function isElectronRoute(url) {
  try {
    const parsedUrl = new URL(url, APP_ORIGIN);
    return parsedUrl.origin === APP_ORIGIN && electronRoutes.has(parsedUrl.pathname);
  } catch {
    return false;
  }
}

export function isBrowserOnlyRoute(url) {
  try {
    const parsedUrl = new URL(url, APP_ORIGIN);
    return (
      parsedUrl.origin === APP_ORIGIN &&
      (parsedUrl.pathname === '/admin' ||
        parsedUrl.pathname.startsWith('/admin/') ||
        parsedUrl.pathname.startsWith('/platform/') ||
        browserOnlyRoutes.has(parsedUrl.pathname))
    );
  } catch {
    return false;
  }
}

export function isLogoutRoute(url) {
  try {
    const parsedUrl = new URL(url, APP_ORIGIN);
    return (
      parsedUrl.origin === APP_ORIGIN && /^\/(logout|sign-out|signout)\/?$/.test(parsedUrl.pathname)
    );
  } catch {
    return false;
  }
}

export async function openInBrowser(url) {
  if (/^https?:\/\//.test(url)) {
    await shell.openExternal(url);
  }
}
