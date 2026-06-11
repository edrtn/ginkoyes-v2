import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Sync
  getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
  triggerSync: () => ipcRenderer.invoke('trigger-sync'),
  getSyncLog: () => ipcRenderer.invoke('get-sync-log'),

  // VPN
  getVpnConfig: () => ipcRenderer.invoke('get-vpn-config'),
  setVpnKey: (key: string) => ipcRenderer.invoke('set-vpn-key', key),
  tailscaleStatus: () => ipcRenderer.invoke('tailscale-status'),
  tailscaleUp: (authKey: string) => ipcRenderer.invoke('tailscale-up', authKey),
  tailscaleDown: () => ipcRenderer.invoke('tailscale-down'),

  // Service
  getServiceStatus: () => ipcRenderer.invoke('get-service-status'),

  // Events
  onSyncOutput: (callback: (data: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: string) => callback(data);
    ipcRenderer.on('sync-output', handler);
    return () => ipcRenderer.removeListener('sync-output', handler);
  },
  onSyncFinished: (callback: (code: number | null) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, code: number | null) => callback(code);
    ipcRenderer.on('sync-finished', handler);
    return () => ipcRenderer.removeListener('sync-finished', handler);
  },
});
