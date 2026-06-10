"use client";

import { useState, useEffect } from "react";

interface DbConfig {
  lanHost: string;
  tailscaleHost: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

interface TestResult {
  success: boolean;
  articleCount?: number;
  error?: string;
}

const defaultConfig: DbConfig = {
  lanHost: "192.168.1.100",
  tailscaleHost: "",
  port: 3306,
  user: "ginkoyes",
  password: "ginkoyes",
  database: "ginkoyes",
};

export default function SettingsPage() {
  const [config, setConfig] = useState<DbConfig>(defaultConfig);
  const [lanTest, setLanTest] = useState<TestResult | null>(null);
  const [tailscaleTest, setTailscaleTest] = useState<TestResult | null>(null);
  const [testingLan, setTestingLan] = useState(false);
  const [testingTailscale, setTestingTailscale] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Detect Electron environment
    const electronAPI = (window as unknown as { electronAPI?: Record<string, unknown> }).electronAPI;
    if (electronAPI) {
      setIsElectron(true);
      (electronAPI.getDbConfig as () => Promise<DbConfig>)().then((cfg: DbConfig) => {
        if (cfg) setConfig(cfg);
      });
    }
  }, []);

  function updateField(field: keyof DbConfig, value: string | number) {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function testConnection(host: string, setResult: (r: TestResult) => void, setTesting: (b: boolean) => void) {
    const electronAPI = (window as unknown as { electronAPI?: Record<string, (...args: unknown[]) => Promise<TestResult>> }).electronAPI;
    if (!electronAPI) {
      setResult({ success: false, error: "Disponible uniquement dans l'application Electron" });
      return;
    }

    setTesting(true);
    setResult(null as unknown as TestResult);

    try {
      const result = await electronAPI.testDbConnection({
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

  async function handleSave() {
    const electronAPI = (window as unknown as { electronAPI?: Record<string, (...args: unknown[]) => Promise<unknown>> }).electronAPI;
    if (!electronAPI) return;

    await electronAPI.setDbConfig(config as unknown as Record<string, unknown>);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Parametres</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configuration de la connexion a la base de donnees MariaDB
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

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Connexion MariaDB</h2>
        </div>

        <div className="space-y-6 p-6">
          {/* LAN Host */}
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
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={() => testConnection(config.lanHost, setLanTest, setTestingLan)}
                  disabled={testingLan || !config.lanHost}
                  className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
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

            {/* Tailscale Host */}
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
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={() => testConnection(config.tailscaleHost, setTailscaleTest, setTestingTailscale)}
                  disabled={testingTailscale || !config.tailscaleHost}
                  className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
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

          {/* Port */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Port</label>
              <input
                type="number"
                value={config.port}
                onChange={(e) => updateField("port", parseInt(e.target.value, 10) || 3306)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Utilisateur</label>
              <input
                type="text"
                value={config.user}
                onChange={(e) => updateField("user", e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Mot de passe</label>
              <input
                type="password"
                value={config.password}
                onChange={(e) => updateField("password", e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={handleSave}
            disabled={!isElectron}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Sauvegarder
          </button>
          {saved && (
            <span className="text-sm text-green-600">Configuration sauvegardee</span>
          )}
        </div>
      </div>
    </div>
  );
}
