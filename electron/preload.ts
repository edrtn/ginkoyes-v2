import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // Database config
  getDbConfig: () => ipcRenderer.invoke("get-db-config"),
  setDbConfig: (config: Record<string, unknown>) =>
    ipcRenderer.invoke("set-db-config", config),
  testDbConnection: (config: Record<string, unknown>) =>
    ipcRenderer.invoke("test-db-connection", config),

  // App info
  getVersion: () => ipcRenderer.invoke("get-version"),

  // Auto-update
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  onUpdateStatus: (callback: (data: unknown) => void) => {
    const handler = (_event: unknown, data: unknown) => callback(data);
    ipcRenderer.on("update-status", handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener("update-status", handler);
  },
});
