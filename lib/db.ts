import mysql, { Pool, PoolConnection } from "mysql2/promise";
import { getConfig } from "./config";

let pool: Pool | null = null;
let poolType: "lan" | "vpn" | null = null;
let connectionMode: "local" | "vpn" | "error" | "unknown" = "unknown";

export function getConnectionMode() {
  return connectionMode;
}

const POOL_COMMON = {
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 5000,
  charset: "utf8mb4" as const,
  decimalNumbers: true,
};

/**
 * Reset the pool (used on config change or connection failure).
 */
export async function resetPool(): Promise<void> {
  if (pool) {
    try {
      await pool.end();
    } catch {
      // Ignore close errors
    }
    pool = null;
    poolType = null;
  }
}

/**
 * Try connecting with LAN host, fallback to Tailscale host.
 */
async function getConnectionWithFailover(): Promise<PoolConnection> {
  const config = getConfig();

  // If we already have a working pool, reuse it
  if (pool) {
    try {
      const conn = await pool.getConnection();
      connectionMode = poolType === "vpn" ? "vpn" : "local";
      return conn;
    } catch {
      await resetPool();
    }
  }

  // Try LAN first
  try {
    pool = mysql.createPool({
      host: config.lanHost,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ...POOL_COMMON,
    });
    poolType = "lan";
    const conn = await pool.getConnection();
    connectionMode = "local";
    return conn;
  } catch {
    await resetPool();
  }

  // LAN failed — try Tailscale/tunnel if configured
  if (!config.tailscaleHost && !config.tunnelPort) {
    throw new Error("Connexion LAN échouée, aucun hôte Tailscale configuré");
  }

  const usesTunnel = config.tunnelPort > 0;

  pool = mysql.createPool({
    host: usesTunnel ? "127.0.0.1" : config.tailscaleHost,
    port: usesTunnel ? config.tunnelPort : config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ...POOL_COMMON,
  });
  poolType = "vpn";
  const conn = await pool.getConnection();
  connectionMode = "vpn";
  return conn;
}

const MAX_RETRIES = 3;

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let conn: PoolConnection | null = null;
    try {
      conn = await getConnectionWithFailover();
      const [rows] = await conn.execute(sql, params as (string | number | null | Buffer)[]);
      return rows as T[];
    } catch (err) {
      lastError = err;
      // Reset pool on connection errors to force reconnection
      await resetPool();
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
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
