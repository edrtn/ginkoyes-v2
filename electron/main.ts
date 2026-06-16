import { app, BrowserWindow, ipcMain, Menu } from "electron";
import path from "path";
import net from "net";
import os from "os";
import mysql from "mysql2/promise";
import store, { DbConfig, VpnConfig } from "./store";
import { startNextServer, stopNextServer } from "./server";
import { setupAutoUpdater } from "./updater";
import { startVpn, stopVpn, getVpnStatus } from "./vpn";
import { startTunnel, stopTunnel, TUNNEL_PORT } from "./tunnel";

let mainWindow: BrowserWindow | null = null;
let serverPort: number | null = null;

// ============================================================
// Convert stored DB config to environment variables
// so that lib/config.ts (inside Next.js) can read them
// ============================================================

function getDbEnvVars(): Record<string, string> {
  const db = store.get("db");
  const vpn = store.get("vpn");
  return {
    DB_LAN_HOST: db.lanHost || "127.0.0.1",
    DB_TAILSCALE_HOST: db.tailscaleHost || "",
    DB_PORT: String(db.port || 3306),
    DB_USER: db.user || "ginkoyes",
    DB_PASSWORD: db.password || "ginkoyes",
    DB_NAME: db.database || "ginkoyes",
    // When VPN is enabled, tell Next.js to use the local tunnel for Tailscale fallback
    DB_TUNNEL_PORT: vpn.enabled ? String(TUNNEL_PORT) : "",
  };
}

// ============================================================
// Create main window
// ============================================================

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Ginkoyes",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (serverPort) {
    mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ============================================================
// Application menu
// ============================================================

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "Ginkoyes",
      submenu: [
        { label: "A propos", role: "about" },
        { type: "separator" },
        { label: "Quitter", accelerator: "CmdOrCtrl+Q", role: "quit" },
      ],
    },
    {
      label: "Edition",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Affichage",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ============================================================
// IPC Handlers
// ============================================================

function setupIpcHandlers() {
  ipcMain.handle("get-db-config", () => {
    return store.get("db");
  });

  ipcMain.handle("set-db-config", async (_event, config: DbConfig) => {
    store.set("db", config);
    // Restart the Next.js server with new env vars so lib/config picks up changes
    if (mainWindow) {
      mainWindow.webContents.send("config-changed");
    }
    return { success: true };
  });

  ipcMain.handle("test-db-connection", async (_event, config) => {
    try {
      const conn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        connectTimeout: 5000,
      });

      const [rows] = await conn.execute(
        "SELECT COUNT(*) AS count FROM ARTARTICLE"
      );
      await conn.end();

      const count = (rows as Array<{ count: number }>)[0]?.count ?? 0;
      return { success: true, articleCount: count };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle("get-version", () => {
    return app.getVersion();
  });

  ipcMain.handle("is-packaged", () => {
    return app.isPackaged;
  });

  // --- VPN handlers ---

  ipcMain.handle("get-vpn-config", () => {
    return store.get("vpn");
  });

  ipcMain.handle("set-vpn-config", async (_event, config: VpnConfig) => {
    store.set("vpn", config);
    return { success: true };
  });

  ipcMain.handle("vpn-start", async () => {
    const vpn = store.get("vpn");
    if (!vpn.authKey) {
      return { success: false, error: "Aucune auth key configuree" };
    }

    const db = store.get("db");
    if (!db.tailscaleHost) {
      return { success: false, error: "Aucun hote Tailscale configure" };
    }

    try {
      // Start the TCP tunnel (idempotent if already running)
      await startTunnel(db.tailscaleHost, db.port || 3306, getVpnStatus().socksPort);
    } catch {
      // Tunnel might already be running — that's OK
    }

    const status = await startVpn(vpn.authKey);
    return { success: status.state === "connected", status };
  });

  ipcMain.handle("vpn-stop", () => {
    stopVpn();
    stopTunnel();
    return { success: true };
  });

  ipcMain.handle("vpn-status", () => {
    return getVpnStatus();
  });

  ipcMain.handle("vpn-refresh-from-db", async () => {
    try {
      await autoConfigureVpnFromDb();
      return {
        success: true,
        vpn: store.get("vpn"),
        tailscaleHost: store.get("db").tailscaleHost,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  // --- Configured flag ---

  ipcMain.handle("get-configured", () => {
    return store.get("configured");
  });

  ipcMain.handle("set-configured", (_event, value: boolean) => {
    store.set("configured", value);
    return { success: true };
  });

  // --- Network scan ---

  ipcMain.handle("scan-network", async () => {
    try {
      const subnet = getLocalSubnet();
      if (!subnet) {
        return { success: false, error: "Impossible de determiner le sous-reseau local", servers: [] };
      }

      // Scan all IPs on port 3306
      const hostsWithPort = await scanSubnetForPort(subnet, 3306, 300);

      // Test MariaDB connection on each host
      const db = store.get("db");
      const servers: Array<{ ip: string; articleCount: number }> = [];

      for (const ip of hostsWithPort) {
        try {
          const conn = await mysql.createConnection({
            host: ip,
            port: db.port || 3306,
            user: db.user || "ginkoyes",
            password: db.password || "ginkoyes",
            database: db.database || "ginkoyes",
            connectTimeout: 3000,
          });
          const [rows] = await conn.execute("SELECT COUNT(*) AS count FROM ARTARTICLE");
          const count = (rows as Array<{ count: number }>)[0]?.count ?? 0;
          await conn.end();
          servers.push({ ip, articleCount: count });
        } catch {
          // Port open but not a valid ginkoyes MariaDB — skip
        }
      }

      return { success: true, subnet, servers };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        servers: [],
      };
    }
  });

  // --- Restart Next.js server (after config change) ---

  ipcMain.handle("restart-server", async () => {
    try {
      stopNextServer();
      const dbEnv = getDbEnvVars();
      serverPort = await startNextServer(dbEnv);
      if (mainWindow) {
        mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);
      }
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
}

// ============================================================
// Network scanning utilities
// ============================================================

function getLocalSubnet(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const addrs = interfaces[name];
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === "IPv4" && !addr.internal) {
        // Extract subnet base (e.g., 192.168.68)
        const parts = addr.address.split(".");
        return `${parts[0]}.${parts[1]}.${parts[2]}`;
      }
    }
  }
  return null;
}

function checkPort(host: string, port: number, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function scanSubnetForPort(subnet: string, port: number, timeout: number): Promise<string[]> {
  const results: string[] = [];
  // Scan in batches of 50 to avoid too many concurrent sockets
  const batchSize = 50;
  for (let start = 1; start <= 254; start += batchSize) {
    const end = Math.min(start + batchSize - 1, 254);
    const batch: Promise<void>[] = [];
    for (let i = start; i <= end; i++) {
      const ip = `${subnet}.${i}`;
      batch.push(
        checkPort(ip, port, timeout).then((open) => {
          if (open) results.push(ip);
        })
      );
    }
    await Promise.all(batch);
  }
  return results;
}

// ============================================================
// Auto-configure VPN from database
// When on LAN, reads _vpn_config to get Tailscale credentials
// so the client is zero-config for VPN.
// ============================================================

async function autoConfigureVpnFromDb(): Promise<void> {
  const db = store.get("db");
  if (!db.lanHost) return;

  let conn;
  try {
    conn = await mysql.createConnection({
      host: db.lanHost,
      port: db.port || 3306,
      user: db.user,
      password: db.password,
      database: db.database,
      connectTimeout: 3000,
    });

    const [rows] = await conn.execute(
      "SELECT tailscale_ip, auth_key, tailnet_name FROM _vpn_config WHERE id = 1"
    );
    const vpnRow = (rows as Array<{ tailscale_ip: string; auth_key: string; tailnet_name: string }>)[0];

    if (vpnRow && vpnRow.tailscale_ip && vpnRow.auth_key) {
      // Update db.tailscaleHost from the server's Tailscale IP
      store.set("db", { ...db, tailscaleHost: vpnRow.tailscale_ip });

      // Update VPN config
      store.set("vpn", {
        authKey: vpnRow.auth_key,
        enabled: true,
      });

      console.log(`[VPN] Auto-configured from DB: ${vpnRow.tailscale_ip}`);
    }
  } catch {
    // LAN not available or table doesn't exist — skip silently
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}

// ============================================================
// App lifecycle
// ============================================================

app.whenReady().then(async () => {
  setupIpcHandlers();
  createMenu();

  // Try to auto-configure VPN from the database (LAN)
  await autoConfigureVpnFromDb();

  // Start VPN tunnel + daemon if enabled
  const vpnCfg = store.get("vpn");
  const dbCfg = store.get("db");

  if (vpnCfg.enabled && vpnCfg.authKey && dbCfg.tailscaleHost) {
    try {
      await startTunnel(dbCfg.tailscaleHost, dbCfg.port || 3306, getVpnStatus().socksPort);
    } catch {
      // Port may be in use — non-fatal
    }
    // Start VPN in background (don't block app startup)
    startVpn(vpnCfg.authKey).catch(() => {
      // VPN start failed — LAN-only mode, non-fatal
    });
  }

  // Start Next.js with DB config as env vars
  const dbEnv = getDbEnvVars();
  serverPort = await startNextServer(dbEnv);

  createWindow();

  // Auto-updater (only in packaged app)
  if (app.isPackaged && mainWindow) {
    setupAutoUpdater(mainWindow);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopVpn();
  stopTunnel();
  stopNextServer();
});
