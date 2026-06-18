/**
 * Configuration runtime pour Ginkoyes V2
 *
 * En dev : lecture depuis variables d'environnement
 * En Electron : lecture depuis electron-store via IPC (window.electronAPI)
 */

export interface DbConfig {
  lanHost: string;
  port: number;
  user: string;
  password: string;
  database: string;
  tunnelHost: string;
  tunnelPort: number;
}

const DEFAULT_CONFIG: DbConfig = {
  lanHost: "192.168.1.100",
  port: 3306,
  user: "ginkoyes",
  password: "ginkoyes",
  database: "ginkoyes",
  tunnelHost: "",
  tunnelPort: 0,
};

let cachedConfig: DbConfig | null = null;

/**
 * Reads DB config from environment variables (server-side / dev mode).
 */
function getEnvConfig(): DbConfig {
  return {
    lanHost: process.env.DB_LAN_HOST || DEFAULT_CONFIG.lanHost,
    port: parseInt(process.env.DB_PORT || String(DEFAULT_CONFIG.port), 10),
    user: process.env.DB_USER || DEFAULT_CONFIG.user,
    password: process.env.DB_PASSWORD || DEFAULT_CONFIG.password,
    database: process.env.DB_NAME || DEFAULT_CONFIG.database,
    tunnelHost: process.env.DB_TUNNEL_HOST || "",
    tunnelPort: parseInt(process.env.DB_TUNNEL_PORT || "0", 10),
  };
}

/**
 * Returns the current DB configuration.
 */
export function getConfig(): DbConfig {
  if (cachedConfig) return cachedConfig;
  cachedConfig = getEnvConfig();
  return cachedConfig;
}

/**
 * Update the cached config (called from Electron IPC when settings change).
 */
export function setConfig(config: DbConfig): void {
  cachedConfig = { ...config };
}

/**
 * Clear cached config (forces re-read on next getConfig call).
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
