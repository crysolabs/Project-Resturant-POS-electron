export type IpcResult<T = unknown> = { success: true } & T | { success: false; error: string };

export type DisplayPreferences = {
  cashierDisplayId: string | null;
  customerDisplayId: string | null;
};

export type WindowAction = "minimize" | "maximize" | "fullscreen" | "close";
export type DesktopEvent = "display-loaded" | "display-closed" | "update-info" | "window-state-changed" | "download-blocked";

export type ElectronApiV1 = {
  getDisplayInfo(): Promise<IpcResult>;
  getDisplayPreferences(): Promise<IpcResult<{ preferences: DisplayPreferences }>>;
  setDisplayPreferences(preferences: Partial<DisplayPreferences>): Promise<IpcResult<{ preferences: DisplayPreferences }>>;
  windowControl(action: WindowAction): Promise<IpcResult>;
  getWindowState(): Promise<IpcResult<{ state: { isMaximized: boolean; isMinimized: boolean; isFullScreen: boolean } }>>;
  getAppInfo(): Promise<IpcResult>;
  checkForUpdates(): Promise<IpcResult>;
  downloadUpdate(): Promise<IpcResult>;
  installUpdate(): Promise<IpcResult>;
  openExternal(url: string): Promise<IpcResult>;
  openWindow(options?: Record<string, unknown>): Promise<IpcResult>;
  focusWindow(options?: Record<string, unknown>): Promise<IpcResult>;
  setFullScreen(options?: { fullscreen?: boolean }): Promise<IpcResult>;
  closeWindow(options?: Record<string, unknown>): Promise<IpcResult>;
  onDisplayLoaded(callback: (payload: unknown) => void): void;
  onDisplayClosed(callback: (payload: unknown) => void): void;
  onUpdateInfo(callback: (payload: unknown) => void): void;
  onWindowStateChanged(callback: (payload: unknown) => void): void;
  onDownloadBlocked(callback: (payload: unknown) => void): void;
  removeDisplayListener(eventName: DesktopEvent, callback: (payload: unknown) => void): void;
};

declare global {
  interface Window {
    electronAPI?: ElectronApiV1;
  }
}
