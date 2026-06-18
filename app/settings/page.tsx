"use client";

import { useState, useEffect, useCallback } from "react";

// ============================================================
// Types
// ============================================================

interface DbConfig {
  lanHost: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

interface SshConfig {
  vpsHost: string;
  vpsPort: number;
  sshUser: string;
  privateKey: string;
  remotePort: number;
  enabled: boolean;
}

interface TunnelStatus {
  state: "disconnected" | "connecting" | "connected" | "error";
  localPort?: number;
  error?: string;
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
  port: 3306,
  user: "ginkoyes",
  password: "ginkoyes",
  database: "ginkoyes",
};

const defaultSshConfig: SshConfig = {
  vpsHost: "85.215.176.58",
  vpsPort: 22,
  sshUser: "tunnel",
  privateKey: "",
  remotePort: 3307,
  enabled: false,
};

// ============================================================
// Shared styles
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
  const [tunnelTest, setTunnelTest] = useState<TestResult | null>(null);
  const [testingLan, setTestingLan] = useState(false);
  const [testingTunnel, setTestingTunnel] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  // --- Scan state ---
  const [scanning, setScanning] = useState(false);
  const [scanServers, setScanServers] = useState<ServerResult[]>([]);
  const [scanDone, setScanDone] = useState(false);
  const [scanError, setScanError] = useState("");

  // --- SSH Tunnel state ---
  const [sshConfig, setSshConfig] = useState<SshConfig>(defaultSshConfig);
  const [tunnelStatus, setTunnelStatus] = useState<TunnelStatus | null>(null);
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [sshSaved, setSshSaved] = useState(false);

  // --- Update state ---
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [isPackaged, setIsPackaged] = useState(false);
  const [electronUpdateStatus, setElectronUpdateStatus] = useState("");
  const [electronUpdateAvailable, setElectronUpdateAvailable] = useState(false);
  const [electronDownloadProgress, setElectronDownloadProgress] = useState<number | null>(null);
  const [electronUpdateReady, setElectronUpdateReady] = useState(false);

  // Dev update state
  const [updateCheck, setUpdateCheck] = useState<{ updateAvailable: boolean; currentCommit: string; remoteCommit: string; behindCount: number } | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<{ success: boolean; message: string; logs: string[] } | null>(null);

  // --- Load config on mount ---
  useEffect(() => {
    const api = getApi();
    if (!api) return;
    setIsElectron(true);

    api.getDbConfig().then((cfg: DbConfig) => {
      if (cfg) setConfig(cfg);
    });
    api.getSshConfig().then((cfg: SshConfig) => {
      if (cfg) setSshConfig(cfg);
    });
    api.tunnelStatus().then((s: TunnelStatus) => {
      if (s) setTunnelStatus(s);
    });
    if (api.isPackaged) {
      api.isPackaged().then((v: boolean) => setIsPackaged(v));
    }
  }, []);

  // --- Poll tunnel status while connecting ---
  useEffect(() => {
    if (!isElectron || tunnelStatus?.state !== "connecting") return;
    const timer = setInterval(() => {
      const api = getApi();
      if (api) {
        api.tunnelStatus().then((s: TunnelStatus) => setTunnelStatus(s));
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [isElectron, tunnelStatus?.state]);

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

  async function testTunnelConnection() {
    const api = getApi();
    if (!api) return;
    setTestingTunnel(true);
    setTunnelTest(null);
    try {
      const result = await api.testDbViaTunnel();
      setTunnelTest(result);
    } catch (err) {
      setTunnelTest({ success: false, error: String(err) });
    } finally {
      setTestingTunnel(false);
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

  // --- SSH Tunnel helpers ---

  const refreshTunnelStatus = useCallback(async () => {
    const api = getApi();
    if (!api) return;
    const s = await api.tunnelStatus();
    setTunnelStatus(s);
  }, []);

  function updateSshField(field: keyof SshConfig, value: string | number | boolean) {
    setSshConfig((prev) => ({ ...prev, [field]: value }));
    setSshSaved(false);
  }

  async function handleSshSave() {
    const api = getApi();
    if (!api) return;
    await api.setSshConfig(sshConfig);
    setSshSaved(true);
    setTimeout(() => setSshSaved(false), 3000);
  }

  async function handleTunnelStart() {
    const api = getApi();
    if (!api) return;
    await api.setSshConfig(sshConfig);
    setTunnelLoading(true);
    try {
      const result = await api.tunnelStart();
      if (result.status) {
        setTunnelStatus(result.status);
      }
      await refreshTunnelStatus();
    } catch (err) {
      setTunnelStatus({ state: "error", error: String(err) });
    } finally {
      setTunnelLoading(false);
    }
  }

  async function handleTunnelStop() {
    const api = getApi();
    if (!api) return;
    setTunnelLoading(true);
    try {
      await api.tunnelStop();
      await refreshTunnelStatus();
    } finally {
      setTunnelLoading(false);
    }
  }

  async function handleTunnelToggle(enabled: boolean) {
    const api = getApi();
    if (!api) return;
    const newCfg = { ...sshConfig, enabled };
    setSshConfig(newCfg);
    await api.setSshConfig(newCfg);
    setSshSaved(true);
    setTimeout(() => setSshSaved(false), 3000);
  }

  // --- Tunnel status helpers ---

  function tunnelDotColor() {
    switch (tunnelStatus?.state) {
      case "connected": return "bg-green-500";
      case "connecting": return "bg-yellow-400 animate-pulse";
      case "error": return "bg-red-500";
      default: return "bg-gray-400";
    }
  }

  function tunnelStateLabel() {
    switch (tunnelStatus?.state) {
      case "connected": return `Connecte (port ${tunnelStatus.localPort})`;
      case "connecting": return "Connexion en cours...";
      case "error": return tunnelStatus.error || "Erreur";
      default: return "Deconnecte";
    }
  }

  // --- Update helpers ---

  useEffect(() => {
    const api = getApi();
    if (!api || !api.onUpdateStatus) return;
    const unsub = api.onUpdateStatus((data: { status: string; version?: string; percent?: number; error?: string }) => {
      switch (data.status) {
        case "checking":
          setElectronUpdateStatus("Verification...");
          break;
        case "available":
          setElectronUpdateAvailable(true);
          setElectronUpdateStatus(`Mise a jour v${data.version || ""} disponible`);
          setChecking(false);
          break;
        case "up-to-date":
          setElectronUpdateAvailable(false);
          setElectronUpdateStatus("Vous etes a jour");
          setChecking(false);
          break;
        case "downloading":
          setElectronDownloadProgress(data.percent ?? null);
          setElectronUpdateStatus("Telechargement...");
          break;
        case "ready":
          setElectronUpdateReady(true);
          setElectronDownloadProgress(null);
          setElectronUpdateStatus(`Mise a jour v${data.version || ""} prete. Redemarrez pour appliquer.`);
          break;
        case "error":
          setCheckError(data.error || "Erreur inconnue");
          setChecking(false);
          break;
      }
    }) as unknown as (() => void);
    return unsub;
  }, []);

  async function handleCheckUpdate() {
    const api = getApi();
    if (api && isPackaged) {
      setChecking(true);
      setCheckError("");
      setElectronUpdateStatus("Verification...");
      setElectronUpdateAvailable(false);
      setElectronUpdateReady(false);
      setElectronDownloadProgress(null);
      try {
        await api.checkForUpdates();
      } catch (err) {
        setCheckError(String(err));
      } finally {
        setChecking(false);
      }
      return;
    }
    setChecking(true);
    setCheckError("");
    setUpdateCheck(null);
    setInstallResult(null);
    try {
      const res = await fetch("/api/updates/check");
      const data = await res.json();
      if (!res.ok) {
        setCheckError(data.error || "Erreur lors de la verification");
      } else {
        setUpdateCheck(data);
      }
    } catch (err) {
      setCheckError(String(err));
    } finally {
      setChecking(false);
    }
  }

  async function handleDownloadUpdate() {
    const api = getApi();
    if (!api) return;
    try {
      await api.downloadUpdate();
    } catch (err) {
      setCheckError(String(err));
    }
  }

  async function handleInstallElectronUpdate() {
    const api = getApi();
    if (!api) return;
    await api.installUpdate();
  }

  async function handleInstallUpdate() {
    setInstalling(true);
    setInstallResult(null);
    try {
      const res = await fetch("/api/updates/install", { method: "POST" });
      const data = await res.json();
      setInstallResult(data);
      if (data.success) {
        setUpdateCheck(null);
      }
    } catch (err) {
      setInstallResult({ success: false, message: String(err), logs: [] });
    } finally {
      setInstalling(false);
    }
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Parametres</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configuration de la connexion et du tunnel SSH
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
          {/* LAN Host */}
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
      {/* SECTION 2 : Tunnel SSH (Relais VPS)                */}
      {/* ================================================== */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Tunnel SSH</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Connexion distante via relais SSH (VPS)
              </p>
            </div>
            {isElectron && tunnelStatus && (
              <div className="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${tunnelDotColor()}`} />
                <span className="text-sm font-medium text-gray-700">{tunnelStateLabel()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6 p-6">
          {/* Info box */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm text-zinc-700">
              Le tunnel SSH permet d&apos;acceder a la base de donnees du magasin depuis n&apos;importe ou,
              en passant par un serveur VPS relais. Le trafic est entierement chiffre.
            </p>
          </div>

          {/* VPS Host + Port */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Adresse du VPS
              </label>
              <input
                type="text"
                value={sshConfig.vpsHost}
                onChange={(e) => updateSshField("vpsHost", e.target.value)}
                placeholder="85.215.176.58"
                className={`mt-1 ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Port SSH
              </label>
              <input
                type="number"
                value={sshConfig.vpsPort}
                onChange={(e) => updateSshField("vpsPort", parseInt(e.target.value, 10) || 22)}
                className={`mt-1 ${inputCls}`}
              />
            </div>
          </div>

          {/* SSH User + Remote Port */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Utilisateur SSH
              </label>
              <input
                type="text"
                value={sshConfig.sshUser}
                onChange={(e) => updateSshField("sshUser", e.target.value)}
                placeholder="tunnel"
                className={`mt-1 ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Port distant (VPS)
              </label>
              <input
                type="number"
                value={sshConfig.remotePort}
                onChange={(e) => updateSshField("remotePort", parseInt(e.target.value, 10) || 3307)}
                className={`mt-1 ${inputCls}`}
              />
            </div>
          </div>

          {/* Private Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Cle privee SSH
            </label>
            <textarea
              value={sshConfig.privateKey}
              onChange={(e) => updateSshField("privateKey", e.target.value)}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
              rows={4}
              className={`mt-1 font-mono text-xs ${inputCls}`}
            />
            <p className="mt-1 text-xs text-gray-500">
              Collez la cle privee Ed25519 pour l&apos;authentification SSH vers le VPS
            </p>
          </div>

          {/* Enable toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleTunnelToggle(!sshConfig.enabled)}
              disabled={!isElectron || !sshConfig.vpsHost || !sshConfig.privateKey}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 ${
                sshConfig.enabled ? "bg-slate-700" : "bg-gray-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  sshConfig.enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <span className="text-sm font-medium text-gray-700">
              Activer le tunnel au demarrage
            </span>
          </div>

          {/* Test tunnel connection */}
          {tunnelStatus?.state === "connected" && (
            <div className="flex items-center gap-3">
              <button
                onClick={testTunnelConnection}
                disabled={testingTunnel}
                className={btnSmall}
              >
                {testingTunnel ? "Test..." : "Tester la connexion DB via tunnel"}
              </button>
              {tunnelTest && (
                <span className={`flex items-center gap-2 text-sm ${tunnelTest.success ? "text-green-600" : "text-red-600"}`}>
                  <span className={`inline-block h-2 w-2 rounded-full ${tunnelTest.success ? "bg-green-500" : "bg-red-500"}`} />
                  {tunnelTest.success
                    ? `Connecte (${tunnelTest.articleCount} articles)`
                    : tunnelTest.error}
                </span>
              )}
            </div>
          )}

          {/* Error message */}
          {tunnelStatus?.state === "error" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-800">{tunnelStatus.error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 px-6 py-4">
          <button onClick={handleSshSave} disabled={!isElectron} className={btnPrimary}>
            Sauvegarder SSH
          </button>

          {sshSaved && (
            <span className="text-sm text-green-600">Sauvegarde</span>
          )}

          {tunnelStatus?.state !== "connected" ? (
            <button
              onClick={handleTunnelStart}
              disabled={!isElectron || tunnelLoading || !sshConfig.vpsHost || !sshConfig.privateKey}
              className={btnPrimary}
            >
              {tunnelLoading ? "Connexion..." : "Demarrer le tunnel"}
            </button>
          ) : (
            <button
              onClick={handleTunnelStop}
              disabled={!isElectron || tunnelLoading}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {tunnelLoading ? "Arret..." : "Arreter le tunnel"}
            </button>
          )}
        </div>
      </div>

      {/* ================================================== */}
      {/* SECTION 3 : Mises a jour                           */}
      {/* ================================================== */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Mises a jour</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {isPackaged ? "Verifier et installer les mises a jour" : "Verifier et installer les mises a jour depuis GitHub (git)"}
          </p>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCheckUpdate}
              disabled={checking}
              className={btnPrimary}
            >
              {checking ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Verification...
                </span>
              ) : (
                "Verifier les mises a jour"
              )}
            </button>

            {isPackaged && electronUpdateStatus && !electronUpdateAvailable && !electronUpdateReady && (
              <span className="flex items-center gap-2 text-sm text-green-600">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                {electronUpdateStatus}
              </span>
            )}

            {!isPackaged && updateCheck && !updateCheck.updateAvailable && (
              <span className="flex items-center gap-2 text-sm text-green-600">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                A jour ({updateCheck.currentCommit})
              </span>
            )}
          </div>

          {checkError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-800">{checkError}</p>
            </div>
          )}

          {isPackaged && electronUpdateAvailable && !electronUpdateReady && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900">{electronUpdateStatus}</p>
                  {electronDownloadProgress != null && (
                    <div className="mt-2 h-2 w-48 rounded-full bg-blue-200">
                      <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${electronDownloadProgress}%` }} />
                    </div>
                  )}
                </div>
                {electronDownloadProgress == null && (
                  <button onClick={handleDownloadUpdate} className={btnPrimary}>
                    Telecharger
                  </button>
                )}
              </div>
            </div>
          )}

          {isPackaged && electronUpdateReady && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-green-800">{electronUpdateStatus}</p>
                <button onClick={handleInstallElectronUpdate} className={btnPrimary}>
                  Redemarrer et installer
                </button>
              </div>
            </div>
          )}

          {!isPackaged && updateCheck?.updateAvailable && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    {updateCheck.behindCount} commit{updateCheck.behindCount > 1 ? "s" : ""} en retard
                  </p>
                  <p className="mt-0.5 text-xs text-blue-700">
                    {updateCheck.currentCommit} → {updateCheck.remoteCommit}
                  </p>
                </div>
                <button
                  onClick={handleInstallUpdate}
                  disabled={installing}
                  className={btnPrimary}
                >
                  {installing ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Installation...
                    </span>
                  ) : (
                    "Installer la mise a jour"
                  )}
                </button>
              </div>
            </div>
          )}

          {!isPackaged && installing && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-transparent" />
              Installation en cours (git pull, npm install, build)...
            </div>
          )}

          {!isPackaged && installResult && (
            <div
              className={`rounded-lg border p-4 ${
                installResult.success
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  installResult.success ? "text-green-800" : "text-red-800"
                }`}
              >
                {installResult.message}
              </p>
              {installResult.logs.length > 0 && (
                <pre className="mt-2 max-h-48 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
                  {installResult.logs.join("\n")}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
