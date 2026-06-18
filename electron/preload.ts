import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // Database config
  getDbConfig: () => ipcRenderer.invoke("get-db-config"),
  setDbConfig: (config: Record<string, unknown>) =>
    ipcRenderer.invoke("set-db-config", config),
  testDbConnection: (config: Record<string, unknown>) =>
    ipcRenderer.invoke("test-db-connection", config),
  testDbViaTunnel: () => ipcRenderer.invoke("test-db-via-tunnel"),

  // App info
  getVersion: () => ipcRenderer.invoke("get-version"),
  isPackaged: () => ipcRenderer.invoke("is-packaged"),

  // Auto-update
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  onUpdateStatus: (callback: (data: unknown) => void) => {
    const handler = (_event: unknown, data: unknown) => callback(data);
    ipcRenderer.on("update-status", handler);
    return () => ipcRenderer.removeListener("update-status", handler);
  },

  // SSH Tunnel
  getSshConfig: () => ipcRenderer.invoke("get-ssh-config"),
  setSshConfig: (config: Record<string, unknown>) =>
    ipcRenderer.invoke("set-ssh-config", config),
  tunnelStart: () => ipcRenderer.invoke("tunnel-start"),
  tunnelStop: () => ipcRenderer.invoke("tunnel-stop"),
  tunnelStatus: () => ipcRenderer.invoke("tunnel-status"),

  // Network scan & setup
  scanNetwork: () => ipcRenderer.invoke("scan-network"),
  getConfigured: () => ipcRenderer.invoke("get-configured"),
  setConfigured: (value: boolean) =>
    ipcRenderer.invoke("set-configured", value),
  restartServer: () => ipcRenderer.invoke("restart-server"),
});
