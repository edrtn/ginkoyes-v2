"use client";

import { useState, useEffect } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElectronAPI = Record<string, (...args: any[]) => Promise<any>>;

function getApi(): ElectronAPI | null {
  const w = window as unknown as { electronAPI?: ElectronAPI };
  return w.electronAPI ?? null;
}

interface ServerResult {
  ip: string;
  articleCount: number;
}

interface TestResult {
  success: boolean;
  articleCount?: number;
  error?: string;
}

export default function ConnectionSetup({
  onConfigured,
}: {
  onConfigured: () => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [servers, setServers] = useState<ServerResult[]>([]);
  const [scanDone, setScanDone] = useState(false);
  const [scanError, setScanError] = useState("");
  const [subnet, setSubnet] = useState("");

  const [hostsFound, setHostsFound] = useState(0);

  const [manualIp, setManualIp] = useState("");
  const [selectedIp, setSelectedIp] = useState("");

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const [connecting, setConnecting] = useState(false);

  // Auto-scan on mount
  useEffect(() => {
    handleScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleScan() {
    const api = getApi();
    if (!api) return;

    setScanning(true);
    setScanDone(false);
    setScanError("");
    setServers([]);
    setHostsFound(0);
    setTestResult(null);

    try {
      const result = await api.scanNetwork();
      if (result.success) {
        setServers(result.servers);
        setSubnet(result.subnet);
        setHostsFound(result.hostsFound ?? 0);
        if (result.servers.length === 1) {
          setSelectedIp(result.servers[0].ip);
          setTestResult({ success: true, articleCount: result.servers[0].articleCount });
        }
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

  function handleSelectServer(ip: string) {
    setSelectedIp(ip);
    setManualIp("");
    // The scan already validated this server — mark as tested
    const server = servers.find((s) => s.ip === ip);
    if (server) {
      setTestResult({ success: true, articleCount: server.articleCount });
    }
  }

  function handleManualIpChange(value: string) {
    setManualIp(value);
    setSelectedIp("");
    setTestResult(null);
  }

  const activeIp = selectedIp || manualIp;

  async function handleTest() {
    const api = getApi();
    if (!api || !activeIp) return;

    setTesting(true);
    setTestResult(null);

    try {
      const dbConfig = await api.getDbConfig();
      const result = await api.testDbConnection({
        host: activeIp,
        port: dbConfig.port || 3306,
        user: dbConfig.user || "ginkoyes",
        password: dbConfig.password || "ginkoyes",
        database: dbConfig.database || "ginkoyes",
      });
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, error: String(err) });
    } finally {
      setTesting(false);
    }
  }

  async function handleConnect() {
    const api = getApi();
    if (!api || !activeIp || !testResult?.success) return;

    setConnecting(true);

    try {
      // Save the IP to config
      const dbConfig = await api.getDbConfig();
      await api.setDbConfig({ ...dbConfig, lanHost: activeIp });

      // Auto-pull SSH tunnel config from server DB
      try {
        const res = await fetch("/api/tunnel-config");
        const tunnelData = await res.json();
        if (tunnelData && tunnelData.vpsHost && api.setSshConfig) {
          await api.setSshConfig({
            vpsHost: tunnelData.vpsHost,
            vpsPort: tunnelData.vpsPort ?? 22,
            sshUser: tunnelData.sshUser ?? "tunnel",
            privateKey: tunnelData.privateKey ?? "",
            remotePort: tunnelData.remotePort ?? 3307,
            enabled: false,
          });
          console.log("[ConnectionSetup] SSH tunnel config pulled from server");
        }
      } catch {
        // Non-blocking: ignore if tunnel config fetch fails
        console.log("[ConnectionSetup] Could not pull SSH tunnel config (non-blocking)");
      }

      // Mark as configured
      await api.setConfigured(true);

      // Restart Next.js server with new config
      await api.restartServer();

      onConfigured();
    } catch (err) {
      setTestResult({
        success: false,
        error: `Erreur de connexion: ${String(err)}`,
      });
      setConnecting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-5">
          <h2 className="text-xl font-bold text-gray-900">
            Configuration initiale
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Connectez-vous au serveur MariaDB sur votre reseau local
          </p>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Scan section */}
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                Scan reseau{subnet ? ` (${subnet}.x)` : ""}
              </h3>
              <button
                onClick={handleScan}
                disabled={scanning}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {scanning ? "Scan en cours..." : "Relancer le scan"}
              </button>
            </div>

            {scanning && (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-violet-100 bg-violet-50 p-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
                <p className="text-sm text-violet-700">
                  Recherche de serveurs MariaDB sur le reseau...
                </p>
              </div>
            )}

            {scanDone && !scanning && (
              <div className="mt-3">
                {servers.length > 0 ? (
                  <div className="space-y-2">
                    {servers.map((server) => (
                      <button
                        key={server.ip}
                        onClick={() => handleSelectServer(server.ip)}
                        className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                          selectedIp === server.ip
                            ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {server.ip}
                          </p>
                          <p className="text-xs text-gray-500">
                            {server.articleCount.toLocaleString()} articles
                          </p>
                        </div>
                        {selectedIp === server.ip && (
                          <span className="text-violet-600">&#10003;</span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm text-amber-800">
                      Aucun serveur MariaDB trouve sur le reseau.
                      {scanError ? ` (${scanError})` : ""}
                    </p>
                    {hostsFound > 0 && (
                      <p className="mt-1 text-xs text-amber-600">
                        {hostsFound} port(s) 3306 detecte(s) mais connexion MariaDB echouee.
                        Verifiez les identifiants (user/password).
                      </p>
                    )}
                    <p className="mt-1 text-xs text-amber-600">
                      Utilisez l&apos;adresse IP manuelle ci-dessous si le scan ne fonctionne pas.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-medium text-gray-400">OU</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {/* Manual IP */}
          <div>
            <label className="block text-sm font-semibold text-gray-700">
              Adresse IP manuelle
            </label>
            <input
              type="text"
              value={manualIp}
              onChange={(e) => handleManualIpChange(e.target.value)}
              placeholder="192.168.1.100"
              className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            />
          </div>

          {/* Test result */}
          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
                testResult.success
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  testResult.success ? "bg-green-500" : "bg-red-500"
                }`}
              />
              {testResult.success
                ? `Connexion reussie (${testResult.articleCount?.toLocaleString()} articles)`
                : testResult.error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={handleTest}
            disabled={!activeIp || testing}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {testing ? "Test en cours..." : "Tester la connexion"}
          </button>
          <button
            onClick={handleConnect}
            disabled={!activeIp || !testResult?.success || connecting}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {connecting ? "Connexion..." : "Se connecter"}
          </button>
        </div>
      </div>
    </div>
  );
}
