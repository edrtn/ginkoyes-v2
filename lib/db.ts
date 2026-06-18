import mysql, { Pool, PoolConnection } from "mysql2/promise";
import { getConfig } from "./config";

let lanPool: Pool | null = null;
let tunnelPool: Pool | null = null;
let poolType: "lan" | "tunnel" | null = null;
let connectionMode: "local" | "vpn" | "error" | "unknown" = "unknown";

/** Background LAN probe timer */
let lanProbeTimer: ReturnType<typeof setInterval> | null = null;
/** When LAN last failed — used to skip inline probe */
let lanFailedAt = 0;

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

// ============================================================
// Background LAN probe — runs every 15s when on tunnel
// Silently tests if LAN became available and switches back
// ============================================================

function startLanProbe() {
  if (lanProbeTimer) return;
  lanProbeTimer = setInterval(async () => {
    // Only probe if we're currently on tunnel
    if (poolType !== "tunnel") return;

    const config = getConfig();
    if (!config.lanHost) return;

    let probePool: Pool | null = null;
    try {
      probePool = mysql.createPool({
        host: config.lanHost,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        connectTimeout: 1500,
        connectionLimit: 1,
        ...POOL_COMMON,
      });
      const conn = await probePool.getConnection();
      // LAN is back! Switch over
      await conn.execute("SELECT 1");
      conn.release();
      console.log("[db] LAN probe: reachable — switching back to LAN");

      // Close old tunnel pool and switch
      if (tunnelPool) {
        try { await tunnelPool.end(); } catch { /* ignore */ }
        tunnelPool = null;
      }
      // Reuse probe pool as the new LAN pool
      lanPool = probePool;
      probePool = null; // don't close it below
      poolType = "lan";
      connectionMode = "local";
      lanFailedAt = 0;
    } catch {
      // LAN still unreachable — stay on tunnel
    } finally {
      if (probePool) {
        try { await probePool.end(); } catch { /* ignore */ }
      }
    }
  }, 15000);
}

/**
 * Get a connection. Priority: LAN > tunnel.
 * When on tunnel, a background probe checks LAN every 15s.
 */
async function getConnection(): Promise<PoolConnection> {
  const config = getConfig();
  const hasTunnel = !!(config.tunnelHost && config.tunnelPort);

  // 1. Reuse LAN pool (preferred)
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

  // 2. Reuse tunnel pool
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

  // 3. Try LAN first — skip if it failed in the last 15s and tunnel exists
  const skipLan = hasTunnel && lanFailedAt && (Date.now() - lanFailedAt < 15000);

  if (config.lanHost && !skipLan) {
    try {
      lanPool = mysql.createPool({
        host: config.lanHost,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        connectTimeout: hasTunnel ? 1500 : 5000,
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

  // 4. Fallback to SSH tunnel
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
    // Start background LAN probe to switch back when LAN returns
    startLanProbe();
    return conn;
  }

  // 5. No tunnel — last resort LAN attempt
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
