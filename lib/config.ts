/**
 * Configuration runtime pour Ginkoyes V2
 *
 * En dev : lecture depuis variables d'environnement
 * En Electron : lecture depuis electron-store via IPC (window.electronAPI)
 */

export interface DbConfig {
  lanHost: string;
  tailscaleHost: string;
  port: number;
  /** Local tunnel port for VPN connections (0 = no tunnel) */
  tunnelPort: number;
  user: string;
  password: string;
  database: string;
}

const DEFAULT_CONFIG: DbConfig = {
  lanHost: "192.168.1.100",
  tailscaleHost: "",
  port: 3306,
  tunnelPort: 0,
  user: "ginkoyes",
  password: "ginkoyes",
  database: "ginkoyes",
};

let cachedConfig: DbConfig | null = null;

/**
 * Reads DB config from environment variables (server-side / dev mode).
 */
function getEnvConfig(): DbConfig {
  return {
    lanHost: process.env.DB_LAN_HOST || DEFAULT_CONFIG.lanHost,
    tailscaleHost: process.env.DB_TAILSCALE_HOST || DEFAULT_CONFIG.tailscaleHost,
    port: parseInt(process.env.DB_PORT || String(DEFAULT_CONFIG.port), 10),
    tunnelPort: parseInt(process.env.DB_TUNNEL_PORT || "0", 10),
    user: process.env.DB_USER || DEFAULT_CONFIG.user,
    password: process.env.DB_PASSWORD || DEFAULT_CONFIG.password,
    database: process.env.DB_NAME || DEFAULT_CONFIG.database,
  };
}

/**
 * Returns the current DB configuration.
 * In Electron production, the config is set via setConfig() from IPC.
 * In dev, reads from environment variables.
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
