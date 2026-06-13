"use client";

import { useState, useEffect } from "react";
import ConnectionSetup from "./ConnectionSetup";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElectronAPI = Record<string, (...args: any[]) => Promise<any>>;

function getApi(): ElectronAPI | null {
  const w = window as unknown as { electronAPI?: ElectronAPI };
  return w.electronAPI ?? null;
}

export default function ConnectionGuard() {
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    const api = getApi();
    if (!api) return; // Not in Electron — skip

    api.getConfigured().then((configured: boolean) => {
      if (!configured) {
        setShowSetup(true);
      }
    });
  }, []);

  if (!showSetup) return null;

  return <ConnectionSetup onConfigured={() => setShowSetup(false)} />;
}
