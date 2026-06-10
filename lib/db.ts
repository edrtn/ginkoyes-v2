import mysql, { Pool, PoolConnection } from "mysql2/promise";
import { getConfig } from "./config";

let pool: Pool | null = null;

/**
 * Create or return the MariaDB connection pool.
 * Tries LAN host first, falls back to Tailscale host.
 */
function getPool(): Pool {
  if (pool) return pool;

  const config = getConfig();

  pool = mysql.createPool({
    host: config.lanHost,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 5000,
    // MariaDB compatible settings
    charset: "utf8mb4",
    decimalNumbers: true,
  });

  return pool;
}

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
  }
}

/**
 * Try connecting with LAN host, fallback to Tailscale host.
 */
async function getConnectionWithFailover(): Promise<PoolConnection> {
  const config = getConfig();

  // Try LAN first
  try {
    const p = getPool();
    const conn = await p.getConnection();
    return conn;
  } catch {
    // LAN failed — try Tailscale if configured
    if (!config.tailscaleHost) throw new Error("Connexion LAN échouée, aucun hôte Tailscale configuré");

    await resetPool();

    pool = mysql.createPool({
      host: config.tailscaleHost,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      connectTimeout: 5000,
      charset: "utf8mb4",
    });

    return pool.getConnection();
  }
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

  throw lastError;
}

export async function queryFirst<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] || null;
}
