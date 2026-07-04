export type IpcResult<T = unknown> = { success: true } & T | { success: false; error: string };

export type DisplayPreferences = {
  cashierDisplayId: string | null;
  customerDisplayId: string | null;
};

export type WindowAction = "minimize" | "maximize" | "fullscreen" | "close";
export type DesktopEvent = "display-loaded" | "display-closed" | "update-info" | "window-state-changed" | "download-blocked" | "access-state-changed";

export type HardwareCapabilities = {
  receiptPrinter: boolean;
  kitchenPrinter: boolean;
  cashDrawer: boolean;
  barcodeScanner: "keyboard-wedge" | "native" | "none";
  customerDisplay: boolean;
  paymentTerminal: boolean;
  weighingScale: boolean;
  labelPrinter: boolean;
};

export type StationSettings = {
  stationKey: string;
  stationName: string;
  receiptPrinterName: string | null;
  kitchenPrinterName: string | null;
  cashDrawerPrinterName: string | null;
  defaultPaper: "58mm" | "80mm";
  autoPrintReceipt: boolean;
  autoPrintKitchenTicket: boolean;
  kitchenRoutes: Record<string, string>;
};

export type ElectronApiV1 = {
  getDisplayInfo(): Promise<IpcResult>;
  getDisplayPreferences(): Promise<IpcResult<{ preferences: DisplayPreferences }>>;
  setDisplayPreferences(preferences: Partial<DisplayPreferences>): Promise<IpcResult<{ preferences: DisplayPreferences }>>;
  windowControl(action: WindowAction): Promise<IpcResult>;
  getWindowState(): Promise<IpcResult<{ state: { isMaximized: boolean; isMinimized: boolean; isFullScreen: boolean } }>>;
  getAppInfo(): Promise<IpcResult>;
  getDiagnostics(): Promise<IpcResult<{ diagnostics: Record<string, unknown> }>>;
  checkForUpdates(): Promise<IpcResult>;
  downloadUpdate(): Promise<IpcResult>;
  installUpdate(): Promise<IpcResult>;
  openExternal(url: string): Promise<IpcResult>;
  openWindow(options?: Record<string, unknown>): Promise<IpcResult>;
  focusWindow(options?: Record<string, unknown>): Promise<IpcResult>;
  setFullScreen(options?: { fullscreen?: boolean }): Promise<IpcResult>;
  closeWindow(options?: Record<string, unknown>): Promise<IpcResult>;
  getHardwareCapabilities(): Promise<IpcResult<{ capabilities: HardwareCapabilities }>>;
  listPrinters(): Promise<IpcResult<{ printers: Array<{ name: string; displayName: string; status?: number; isDefault: boolean }> }>>;
  getStationSettings(): Promise<IpcResult<{ settings: StationSettings }>>;
  setStationSettings(settings: Partial<StationSettings>): Promise<IpcResult<{ settings: StationSettings }>>;
  previewReceipt(payload?: Record<string, unknown>): Promise<IpcResult<{ preview: { html: string } }>>;
  printReceipt(payload?: Record<string, unknown>): Promise<IpcResult<{ job: Record<string, unknown> }>>;
  testPrint(payload?: Record<string, unknown>): Promise<IpcResult<{ job: Record<string, unknown> }>>;
  openCashDrawer(payload?: Record<string, unknown>): Promise<IpcResult<{ job: Record<string, unknown> }>>;
  getPrintHistory(): Promise<IpcResult<{ history: Array<Record<string, unknown>> }>>;
  onDisplayLoaded(callback: (payload: unknown) => void): void;
  onDisplayClosed(callback: (payload: unknown) => void): void;
  onUpdateInfo(callback: (payload: unknown) => void): void;
  onWindowStateChanged(callback: (payload: unknown) => void): void;
  onDownloadBlocked(callback: (payload: unknown) => void): void;
  onAccessStateChanged(callback: (payload: unknown) => void): void;
  removeDisplayListener(eventName: DesktopEvent, callback: (payload: unknown) => void): void;
};

declare global {
  interface Window {
    electronAPI?: ElectronApiV1;
  }
}
