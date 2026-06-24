import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Sync
  getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
  triggerSync: () => ipcRenderer.invoke('trigger-sync'),
  getSyncLog: () => ipcRenderer.invoke('get-sync-log'),

  // Tunnel SSH
  getTunnelConfig: () => ipcRenderer.invoke('get-tunnel-config'),
  setTunnelConfig: (config: { vps_host: string; vps_port: number; ssh_user: string; private_key: string; remote_port: number }) =>
    ipcRenderer.invoke('set-tunnel-config', config),

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
