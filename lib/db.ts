import mysql, { Pool, PoolConnection } from "mysql2/promise";
import { getConfig } from "./config";

let lanPool: Pool | null = null;
let tunnelPool: Pool | null = null;
let poolType: "lan" | "tunnel" | null = null;
let connectionMode: "local" | "vpn" | "error" | "unknown" = "unknown";

/** Track LAN failures to skip slow LAN probe when we know it's down */
let lanFailedAt = 0;
const LAN_RETRY_COOLDOWN = 30000; // 30s before retrying LAN after failure

export function getConnectionMode() {
  return connectionMode;
}

const POOL_COMMON = {
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4" as const,
  decimalNumbers: true,
};

/**
 * Reset pools (used on config change or connection failure).
 */
export async function resetPool(): Promise<void> {
  if (lanPool) {
    try { await lanPool.end(); } catch { /* ignore */ }
    lanPool = null;
  }
  if (tunnelPool) {
    try { await tunnelPool.end(); } catch { /* ignore */ }
    tunnelPool = null;
  }
  poolType = null;
}

/**
 * Try to reuse existing pool, or discover which pool works.
 * When tunnel is available, LAN probe uses a short timeout (1.5s)
 * so we don't block every request for 5s when off-site.
 */
async function getConnection(): Promise<PoolConnection> {
  const config = getConfig();
  const hasTunnel = !!(config.tunnelHost && config.tunnelPort);

  // 1. Reuse existing working pool
  if (poolType === "tunnel" && tunnelPool) {
    try {
      const conn = await tunnelPool.getConnection();
      connectionMode = "vpn";
      return conn;
    } catch {
      tunnelPool = null;
      poolType = null;
    }
  }

  if (poolType === "lan" && lanPool) {
    try {
      const conn = await lanPool.getConnection();
      connectionMode = "local";
      return conn;
    } catch {
      lanPool = null;
      poolType = null;
      lanFailedAt = Date.now();
    }
  }

  // 2. Probe LAN — but skip if it failed recently and we have a tunnel
  const lanCooldownActive = hasTunnel && lanFailedAt && (Date.now() - lanFailedAt < LAN_RETRY_COOLDOWN);

  if (config.lanHost && !lanCooldownActive) {
    try {
      lanPool = mysql.createPool({
        host: config.lanHost,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        connectTimeout: hasTunnel ? 1500 : 5000, // fast probe when tunnel available
        ...POOL_COMMON,
      });
      const conn = await lanPool.getConnection();
      poolType = "lan";
      connectionMode = "local";
      lanFailedAt = 0;
      return conn;
    } catch {
      if (lanPool) {
        try { await lanPool.end(); } catch { /* ignore */ }
        lanPool = null;
      }
      lanFailedAt = Date.now();
    }
  }

  // 3. Fallback to SSH tunnel
  if (hasTunnel) {
    tunnelPool = mysql.createPool({
      host: config.tunnelHost,
      port: config.tunnelPort,
      user: config.user,
      password: config.password,
      database: config.database,
      connectTimeout: 5000,
      ...POOL_COMMON,
    });
    const conn = await tunnelPool.getConnection();
    poolType = "tunnel";
    connectionMode = "vpn";
    return conn;
  }

  // 4. No tunnel — last resort LAN attempt
  lanPool = mysql.createPool({
    host: config.lanHost,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectTimeout: 5000,
    ...POOL_COMMON,
  });
  const conn = await lanPool.getConnection();
  poolType = "lan";
  connectionMode = "local";
  return conn;
}

const MAX_RETRIES = 2;

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let conn: PoolConnection | null = null;
    try {
      conn = await getConnection();
      const [rows] = await conn.execute(sql, params as (string | number | null | Buffer)[]);
      return rows as T[];
    } catch (err) {
      lastError = err;
      await resetPool();
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      if (conn) conn.release();
    }
  }

  connectionMode = "error";
  throw lastError;
}

export async function queryFirst<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] || null;
}
