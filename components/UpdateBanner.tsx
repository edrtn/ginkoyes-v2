"use client";

import { useState, useEffect } from "react";

interface UpdateStatus {
  status: "checking" | "available" | "downloading" | "ready" | "up-to-date" | "error";
  version?: string;
  percent?: number;
  error?: string;
}

interface ElectronAPI {
  checkForUpdates: () => Promise<{ success: boolean; version?: string }>;
  downloadUpdate: () => Promise<{ success: boolean }>;
  installUpdate: () => void;
  onUpdateStatus: (cb: (data: UpdateStatus) => void) => () => void;
}

function getAPI(): ElectronAPI | null {
  const w = window as unknown as { electronAPI?: ElectronAPI };
  return w.electronAPI ?? null;
}

export default function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    const api = getAPI();
    if (!api || typeof api.onUpdateStatus !== "function") return;

    const cleanup = api.onUpdateStatus((data) => {
      setUpdate(data);
    });

    return cleanup;
  }, []);

  if (!update || update.status === "checking" || update.status === "up-to-date") {
    return null;
  }

  if (update.status === "error") {
    return null; // Silently ignore update errors
  }

  const api = getAPI();
  if (!api) return null;

  return (
    <div className="border-b border-indigo-200 bg-indigo-50 px-4 py-2">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {update.status === "available" && (
          <>
            <span className="text-sm text-indigo-800">
              Nouvelle version {update.version} disponible
            </span>
            <button
              onClick={() => api.downloadUpdate()}
              className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
            >
              Telecharger
            </button>
          </>
        )}

        {update.status === "downloading" && (
          <>
            <span className="text-sm text-indigo-800">
              Telechargement en cours... {update.percent}%
            </span>
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-indigo-200">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all"
                style={{ width: `${update.percent ?? 0}%` }}
              />
            </div>
          </>
        )}

        {update.status === "ready" && (
          <>
            <span className="text-sm text-indigo-800">
              Version {update.version} prete. Redemarrer pour installer.
            </span>
            <button
              onClick={() => api.installUpdate()}
              className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
            >
              Redemarrer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
