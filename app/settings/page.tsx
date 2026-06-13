"use client";

import { useState, useEffect, useCallback } from "react";

// ============================================================
// Types
// ============================================================

interface DbConfig {
  lanHost: string;
  tailscaleHost: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

interface VpnConfig {
  authKey: string;
  enabled: boolean;
}

interface VpnStatus {
  state: "disconnected" | "connecting" | "connected" | "error";
  ip?: string;
  error?: string;
  socksPort: number;
}

interface TestResult {
  success: boolean;
  articleCount?: number;
  error?: string;
}

interface ServerResult {
  ip: string;
  articleCount: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElectronAPI = Record<string, (...args: any[]) => Promise<any>>;

function getApi(): ElectronAPI | null {
  const w = window as unknown as { electronAPI?: ElectronAPI };
  return w.electronAPI ?? null;
}

// ============================================================
// Defaults
// ============================================================

const defaultDbConfig: DbConfig = {
  lanHost: "192.168.1.100",
  tailscaleHost: "",
  port: 3306,
  user: "ginkoyes",
  password: "ginkoyes",
  database: "ginkoyes",
};

const defaultVpnConfig: VpnConfig = {
  authKey: "",
  enabled: false,
};

// ============================================================
// Shared input class
// ============================================================

const inputCls =
  "block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:ring-1 focus:ring-slate-400";
const btnPrimary =
  "rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50";
const btnSmall =
  "shrink-0 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50";

// ============================================================
// Component
// ============================================================

export default function SettingsPage() {
  // --- DB state ---
  const [config, setConfig] = useState<DbConfig>(defaultDbConfig);
  const [lanTest, setLanTest] = useState<TestResult | null>(null);
  const [tailscaleTest, setTailscaleTest] = useState<TestResult | null>(null);
  const [testingLan, setTestingLan] = useState(false);
  const [testingTailscale, setTestingTailscale] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  // --- Scan state ---
  const [scanning, setScanning] = useState(false);
  const [scanServers, setScanServers] = useState<ServerResult[]>([]);
  const [scanDone, setScanDone] = useState(false);
  const [scanError, setScanError] = useState("");

  // --- VPN state ---
  const [vpnConfig, setVpnConfig] = useState<VpnConfig>(defaultVpnConfig);
  const [vpnStatus, setVpnStatus] = useState<VpnStatus | null>(null);
  const [vpnLoading, setVpnLoading] = useState(false);
  const [vpnRefreshing, setVpnRefreshing] = useState(false);
  const [vpnSaved, setVpnSaved] = useState(false);

  // --- Load config on mount ---
  useEffect(() => {
    const api = getApi();
    if (!api) return;
    setIsElectron(true);

    api.getDbConfig().then((cfg: DbConfig) => {
      if (cfg) setConfig(cfg);
    });
    api.getVpnConfig().then((cfg: VpnConfig) => {
      if (cfg) setVpnConfig(cfg);
    });
    api.vpnStatus().then((s: VpnStatus) => {
      if (s) setVpnStatus(s);
    });
  }, []);

  // --- Poll VPN status while connecting ---
  useEffect(() => {
    if (!isElectron || vpnStatus?.state !== "connecting") return;
    const timer = setInterval(() => {
      const api = getApi();
      if (api) {
        api.vpnStatus().then((s: VpnStatus) => setVpnStatus(s));
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [isElectron, vpnStatus?.state]);

  // --- DB helpers ---

  function updateField(field: keyof DbConfig, value: string | number) {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function testConnection(
    host: string,
    setResult: (r: TestResult | null) => void,
    setTesting: (b: boolean) => void
  ) {
    const api = getApi();
    if (!api) {
      setResult({ success: false, error: "Disponible uniquement dans l'application Electron" });
      return;
    }
    setTesting(true);
    setResult(null);
    try {
      const result = await api.testDbConnection({
        host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
      });
      setResult(result);
    } catch (err) {
      setResult({ success: false, error: String(err) });
    } finally {
      setTesting(false);
    }
  }

  async function handleScan() {
    const api = getApi();
    if (!api) return;
    setScanning(true);
    setScanDone(false);
    setScanError("");
    setScanServers([]);
    try {
      const result = await api.scanNetwork();
      if (result.success) {
        setScanServers(result.servers);
      } else {
        setScanError(result.error || "Erreur inconnue");
      }
    } catch (err) {
      setScanError(String(err));
    } finally {
      setScanning(false);
      setScanDone(true);
    }
  }

  function handleSelectScannedServer(ip: string) {
    setConfig((prev) => ({ ...prev, lanHost: ip }));
    setSaved(false);
  }

  async function handleSave() {
    const api = getApi();
    if (!api) return;
    await api.setDbConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  // --- VPN helpers ---

  const refreshVpnStatus = useCallback(async () => {
    const api = getApi();
    if (!api) return;
    const s = await api.vpnStatus();
    setVpnStatus(s);
  }, []);

  async function handleVpnStart() {
    const api = getApi();
    if (!api) return;
    setVpnLoading(true);
    try {
      await api.vpnStart();
      await refreshVpnStatus();
    } finally {
      setVpnLoading(false);
    }
  }

  async function handleVpnStop() {
    const api = getApi();
    if (!api) return;
    setVpnLoading(true);
    try {
      await api.vpnStop();
      await refreshVpnStatus();
    } finally {
      setVpnLoading(false);
    }
  }

  async function handleVpnToggle(enabled: boolean) {
    const api = getApi();
    if (!api) return;
    const newCfg = { ...vpnConfig, enabled };
    setVpnConfig(newCfg);
    await api.setVpnConfig(newCfg);
    setVpnSaved(true);
    setTimeout(() => setVpnSaved(false), 3000);
  }

  async function handleRefreshFromDb() {
    const api = getApi();
    if (!api) return;
    setVpnRefreshing(true);
    try {
      const result = await api.vpnRefreshFromDb();
      if (result.success) {
        if (result.vpn) setVpnConfig(result.vpn);
        if (result.tailscaleHost) {
          setConfig((prev) => ({ ...prev, tailscaleHost: result.tailscaleHost }));
        }
      }
    } finally {
      setVpnRefreshing(false);
    }
  }

  // --- VPN status helpers ---

  function vpnDotColor() {
    switch (vpnStatus?.state) {
      case "connected": return "bg-green-500";
      case "connecting": return "bg-yellow-400 animate-pulse";
      case "error": return "bg-red-500";
      default: return "bg-gray-400";
    }
  }

  function vpnStateLabel() {
    switch (vpnStatus?.state) {
      case "connected": return `Connecte${vpnStatus.ip ? ` (${vpnStatus.ip})` : ""}`;
      case "connecting": return "Connexion en cours...";
      case "error": return vpnStatus.error || "Erreur";
      default: return "Deconnecte";
    }
  }

  function maskKey(key: string) {
    if (!key || key.length < 12) return key || "";
    return key.slice(0, 6) + "..." + key.slice(-4);
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Parametres</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configuration de la connexion et du VPN
        </p>
      </div>

      {!isElectron && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            La gestion de la configuration est disponible uniquement dans l&apos;application Electron.
            En mode developpement, les variables d&apos;environnement sont utilisees.
          </p>
        </div>
      )}

      {/* ================================================== */}
      {/* SECTION 1 : Connexion MariaDB                      */}
      {/* ================================================== */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Connexion MariaDB</h2>
        </div>

        <div className="space-y-6 p-6">
          {/* LAN Host + Tailscale Host */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                IP LAN (reseau local)
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={config.lanHost}
                  onChange={(e) => updateField("lanHost", e.target.value)}
                  placeholder="192.168.1.100"
                  className={inputCls}
                />
                <button
                  onClick={() => testConnection(config.lanHost, setLanTest, setTestingLan)}
                  disabled={testingLan || !config.lanHost}
                  className={btnSmall}
                >
                  {testingLan ? "Test..." : "Tester"}
                </button>
              </div>
              {lanTest && (
                <div className={`mt-2 flex items-center gap-2 text-sm ${lanTest.success ? "text-green-600" : "text-red-600"}`}>
                  <span className={`inline-block h-2 w-2 rounded-full ${lanTest.success ? "bg-green-500" : "bg-red-500"}`} />
                  {lanTest.success
                    ? `Connecte (${lanTest.articleCount} articles)`
                    : lanTest.error}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                IP Tailscale (VPN)
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={config.tailscaleHost}
                  onChange={(e) => updateField("tailscaleHost", e.target.value)}
                  placeholder="100.x.x.x"
                  className={inputCls}
                />
                <button
                  onClick={() => testConnection(config.tailscaleHost, setTailscaleTest, setTestingTailscale)}
                  disabled={testingTailscale || !config.tailscaleHost}
                  className={btnSmall}
                >
                  {testingTailscale ? "Test..." : "Tester"}
                </button>
              </div>
              {tailscaleTest && (
                <div className={`mt-2 flex items-center gap-2 text-sm ${tailscaleTest.success ? "text-green-600" : "text-red-600"}`}>
                  <span className={`inline-block h-2 w-2 rounded-full ${tailscaleTest.success ? "bg-green-500" : "bg-red-500"}`} />
                  {tailscaleTest.success
                    ? `Connecte (${tailscaleTest.articleCount} articles)`
                    : tailscaleTest.error}
                </div>
              )}
            </div>
          </div>

          {/* Network scan */}
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-700">Recherche automatique</h3>
                <p className="text-xs text-gray-500">Scanner le reseau local pour trouver un serveur MariaDB</p>
              </div>
              <button
                onClick={handleScan}
                disabled={!isElectron || scanning}
                className={btnSmall}
              >
                {scanning ? "Scan..." : "Scanner le reseau"}
              </button>
            </div>

            {scanning && (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-transparent" />
                Recherche en cours...
              </div>
            )}

            {scanDone && !scanning && (
              <div className="mt-3">
                {scanServers.length > 0 ? (
                  <div className="space-y-1.5">
                    {scanServers.map((s) => (
                      <button
                        key={s.ip}
                        onClick={() => handleSelectScannedServer(s.ip)}
                        className={`flex w-full items-center justify-between rounded-lg border p-2.5 text-left text-sm transition-colors ${
                          config.lanHost === s.ip
                            ? "border-slate-400 bg-slate-50"
                            : "border-gray-200 hover:bg-white"
                        }`}
                      >
                        <span className="font-medium text-gray-900">{s.ip}</span>
                        <span className="text-xs text-gray-500">{s.articleCount.toLocaleString()} articles</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-amber-700">
                    Aucun serveur trouve.{scanError ? ` ${scanError}` : ""}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Port / User / Password */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Port</label>
              <input
                type="number"
                value={config.port}
                onChange={(e) => updateField("port", parseInt(e.target.value, 10) || 3306)}
                className={`mt-1 ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Utilisateur</label>
              <input
                type="text"
                value={config.user}
                onChange={(e) => updateField("user", e.target.value)}
                className={`mt-1 ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Mot de passe</label>
              <input
                type="password"
                value={config.password}
                onChange={(e) => updateField("password", e.target.value)}
                className={`mt-1 ${inputCls}`}
              />
            </div>
          </div>

          {/* Database */}
          <div className="max-w-sm">
            <label className="block text-sm font-medium text-gray-700">Base de donnees</label>
            <input
              type="text"
              value={config.database}
              onChange={(e) => updateField("database", e.target.value)}
              className={`mt-1 ${inputCls}`}
            />
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 border-t border-gray-200 px-6 py-4">
          <button onClick={handleSave} disabled={!isElectron} className={btnPrimary}>
            Sauvegarder
          </button>
          {saved && (
            <span className="text-sm text-green-600">Configuration sauvegardee</span>
          )}
        </div>
      </div>

      {/* ================================================== */}
      {/* SECTION 2 : VPN Tailscale                          */}
      {/* ================================================== */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">VPN Tailscale</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Tunnel securise pour l&apos;acces distant
              </p>
            </div>
            {/* Status badge */}
            {isElectron && vpnStatus && (
              <div className="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${vpnDotColor()}`} />
                <span className="text-sm font-medium text-gray-700">{vpnStateLabel()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6 p-6">
          {/* Info box */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm text-zinc-700">
              La configuration VPN est recuperee automatiquement depuis la base de donnees
              du serveur lors d&apos;une connexion en reseau local. Vous pouvez aussi la rafraichir
              manuellement.
            </p>
          </div>

          {/* Server IP + Auth key (read-only, auto-configured) */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                IP Tailscale du serveur
              </label>
              <input
                type="text"
                value={config.tailscaleHost}
                readOnly
                className={`mt-1 ${inputCls} bg-gray-50 text-gray-500`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Auth key
              </label>
              <input
                type="text"
                value={maskKey(vpnConfig.authKey)}
                readOnly
                className={`mt-1 ${inputCls} bg-gray-50 text-gray-500`}
              />
            </div>
          </div>

          {/* Enable toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleVpnToggle(!vpnConfig.enabled)}
              disabled={!isElectron || !vpnConfig.authKey}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 ${
                vpnConfig.enabled ? "bg-slate-700" : "bg-gray-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  vpnConfig.enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <span className="text-sm font-medium text-gray-700">
              Activer le VPN au demarrage
            </span>
            {vpnSaved && (
              <span className="text-sm text-green-600">Sauvegarde</span>
            )}
          </div>

          {/* Error message */}
          {vpnStatus?.state === "error" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-800">{vpnStatus.error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={handleRefreshFromDb}
            disabled={!isElectron || vpnRefreshing}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {vpnRefreshing ? "Rafraichissement..." : "Rafraichir depuis la base"}
          </button>

          {vpnStatus?.state !== "connected" ? (
            <button
              onClick={handleVpnStart}
              disabled={!isElectron || vpnLoading || !vpnConfig.authKey || !config.tailscaleHost}
              className={btnPrimary}
            >
              {vpnLoading ? "Connexion..." : "Demarrer le VPN"}
            </button>
          ) : (
            <button
              onClick={handleVpnStop}
              disabled={!isElectron || vpnLoading}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {vpnLoading ? "Arret..." : "Arreter le VPN"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
