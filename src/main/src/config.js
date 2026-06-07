import { app } from 'electron';
export { POS_SESSION_PARTITION, DISPLAY_WINDOW_ID } from './constants';
import { DEVELOPMENT_APP_URL, PRODUCTION_APP_URL } from './constants';
export function getAppBaseUrl() {
  const configured = app.isPackaged
    ? import.meta.env.MAIN_VITE_APPURI
    : import.meta.env.MAIN_VITE_DEV_APPURI;
  return new URL(configured || (app.isPackaged ? PRODUCTION_APP_URL : DEVELOPMENT_APP_URL)).origin;
}
