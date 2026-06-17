"use client";

import { useEffect, useState } from "react";

type Mode = "local" | "vpn" | "error" | "unknown";

const CONFIG: Record<Mode, { label: string; dot: string }> = {
  local: { label: "Local", dot: "bg-green-500" },
  vpn: { label: "VPN", dot: "bg-amber-500" },
  error: { label: "Déconnecté", dot: "bg-red-500" },
  unknown: { label: "...", dot: "bg-gray-400" },
};

export default function ConnectionIndicator() {
  const [mode, setMode] = useState<Mode>("unknown");

  useEffect(() => {
    const fetchMode = () =>
      fetch("/api/connection-mode")
        .then((r) => r.json())
        .then((d) => setMode(d.mode ?? "unknown"))
        .catch(() => setMode("error"));

    fetchMode();
    const id = setInterval(fetchMode, 10_000);
    return () => clearInterval(id);
  }, []);

  const { label, dot } = CONFIG[mode];

  return (
    <div className="fixed top-3 right-4 z-50 flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-medium shadow-sm backdrop-blur">
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
      {label}
    </div>
  );
}
