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

  // VPN
  getVpnConfig: () => ipcRenderer.invoke("get-vpn-config"),
  setVpnConfig: (config: Record<string, unknown>) =>
    ipcRenderer.invoke("set-vpn-config", config),
  vpnStart: () => ipcRenderer.invoke("vpn-start"),
  vpnStop: () => ipcRenderer.invoke("vpn-stop"),
  vpnStatus: () => ipcRenderer.invoke("vpn-status"),
  vpnRefreshFromDb: () => ipcRenderer.invoke("vpn-refresh-from-db"),

  // Network scan & setup
  scanNetwork: () => ipcRenderer.invoke("scan-network"),
  getConfigured: () => ipcRenderer.invoke("get-configured"),
  setConfigured: (value: boolean) =>
    ipcRenderer.invoke("set-configured", value),
  restartServer: () => ipcRenderer.invoke("restart-server"),
});
