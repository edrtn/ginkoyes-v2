import { autoUpdater } from "electron-updater";
import { BrowserWindow, ipcMain } from "electron";

let mainWin: BrowserWindow | null = null;

export function setupAutoUpdater(window: BrowserWindow): void {
  mainWin = window;

  // Don't auto-download — let the user decide
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // ============================================================
  // Events → send to renderer via IPC
  // ============================================================

  autoUpdater.on("checking-for-update", () => {
    sendToRenderer("update-status", { status: "checking" });
  });

  autoUpdater.on("update-available", (info) => {
    sendToRenderer("update-status", {
      status: "available",
      version: info.version,
    });
  });

  autoUpdater.on("update-not-available", () => {
    sendToRenderer("update-status", { status: "up-to-date" });
  });

  autoUpdater.on("download-progress", (progress) => {
    sendToRenderer("update-status", {
      status: "downloading",
      percent: Math.round(progress.percent),
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    sendToRenderer("update-status", {
      status: "ready",
      version: info.version,
    });
  });

  autoUpdater.on("error", (err) => {
    sendToRenderer("update-status", {
      status: "error",
      error: err.message,
    });
  });

  // ============================================================
  // IPC handlers from renderer
  // ============================================================

  ipcMain.handle("check-for-updates", async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, version: result?.updateInfo.version };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("download-update", async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("install-update", () => {
    autoUpdater.quitAndInstall(false, true);
  });

  // ============================================================
  // Check for updates on startup (silently, after 5s delay)
  // ============================================================

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // Silently ignore — user is not connected or no repo configured
    });
  }, 5000);
}

function sendToRenderer(channel: string, data: unknown): void {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send(channel, data);
  }
}
