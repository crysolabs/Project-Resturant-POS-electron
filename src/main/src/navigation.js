import { shell } from 'electron';
import { getAppBaseUrl } from './config';

export const APP_ORIGIN = getAppBaseUrl();
export const ELECTRON_USER_AGENT_TOKEN = 'CRYSO-Electron Electron';
export const DEFAULT_ROUTE = '/login';
export const DISPLAY_ROUTE = '/pos/display';
const allowedExternalProtocols = new Set(['https:', 'mailto:']);
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
export function appUrl(pathname = DEFAULT_ROUTE) {
  return new URL(pathname, APP_ORIGIN).toString();
}
export function electronUserAgent(currentUserAgent = '') {
  const token = ELECTRON_USER_AGENT_TOKEN + '/' + process.versions.electron;
  return currentUserAgent.includes(ELECTRON_USER_AGENT_TOKEN)
    ? currentUserAgent
    : (currentUserAgent + ' ' + token).trim();
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
    const parsed = new URL(url, APP_ORIGIN);
    return parsed.origin === APP_ORIGIN && electronRoutes.has(parsed.pathname);
  } catch {
    return false;
  }
}
export function isDisplayRoute(url) {
  try {
    const parsed = new URL(url, APP_ORIGIN);
    return parsed.origin === APP_ORIGIN && parsed.pathname === DISPLAY_ROUTE;
  } catch {
    return false;
  }
}
export function isBrowserOnlyRoute(url) {
  try {
    const parsed = new URL(url, APP_ORIGIN);
    return (
      parsed.origin === APP_ORIGIN &&
      (parsed.pathname === '/admin' ||
        parsed.pathname.startsWith('/admin/') ||
        parsed.pathname.startsWith('/platform/'))
    );
  } catch {
    return false;
  }
}
export function isLogoutRoute(url) {
  try {
    const parsed = new URL(url, APP_ORIGIN);
    return parsed.origin === APP_ORIGIN && /^\/(logout|sign-out|signout)\/?$/.test(parsed.pathname);
  } catch {
    return false;
  }
}
export async function openInBrowser(url) {
  try {
    const parsed = new URL(url);
    if (allowedExternalProtocols.has(parsed.protocol)) await shell.openExternal(url);
  } catch {
    return;
  }
}
