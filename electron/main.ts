import { app, BrowserWindow, ipcMain, Menu } from "electron";
import path from "path";
import net from "net";
import os from "os";
import { exec as execCb, execFile as execFileCb } from "child_process";
import { promisify } from "util";

const execAsync = promisify(execCb);
const execFileAsync = promisify(execFileCb);
import store, { DbConfig, SshConfig } from "./store";
import { startNextServer, stopNextServer } from "./server";
import { setupAutoUpdater } from "./updater";
import { startTunnel, stopTunnel, getTunnelStatus, getTunnelPort } from "./ssh-tunnel";

let mainWindow: BrowserWindow | null = null;
let serverPort: number | null = null;

// ============================================================
// Convert stored DB config to environment variables
// so that lib/config.ts (inside Next.js) can read them
// ============================================================

function getDbEnvVars(): Record<string, string> {
  const db = store.get("db");
  const tunnelPort = getTunnelPort();
  return {
    DB_LAN_HOST: db.lanHost || "127.0.0.1",
    DB_PORT: String(db.port || 3306),
    DB_USER: db.user || "ginkoyes",
    DB_PASSWORD: db.password || "ginkoyes",
    DB_NAME: db.database || "ginkoyes",
    // SSH tunnel info for failover
    DB_TUNNEL_HOST: tunnelPort ? "127.0.0.1" : "",
    DB_TUNNEL_PORT: tunnelPort ? String(tunnelPort) : "",
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
    title: "SportLink",
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
      label: "SportLink",
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
    if (mainWindow) {
      mainWindow.webContents.send("config-changed");
    }
    return { success: true };
  });

  ipcMain.handle("test-db-connection", async (_event, config) => {
    try {
      const count = await testMariaDb(config.host, config);
      return { success: true, articleCount: count };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  // Test DB via SSH tunnel
  ipcMain.handle("test-db-via-tunnel", async () => {
    const tunnelStatus = getTunnelStatus();
    if (tunnelStatus.state !== "connected" || !tunnelStatus.localPort) {
      return { success: false, error: "Tunnel SSH non connecte." };
    }
    try {
      const db = store.get("db");
      const count = await testMariaDb("127.0.0.1", {
        ...db,
        port: tunnelStatus.localPort,
      });
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

  // --- SSH Tunnel handlers ---

  ipcMain.handle("get-ssh-config", () => {
    return store.get("ssh");
  });

  ipcMain.handle("set-ssh-config", async (_event, config: SshConfig) => {
    store.set("ssh", config);
    return { success: true };
  });

  ipcMain.handle("tunnel-start", async () => {
    const ssh = store.get("ssh");
    if (!ssh.vpsHost) {
      return { success: false, error: "Aucun serveur VPS configure" };
    }
    if (!ssh.privateKey) {
      return { success: false, error: "Cle SSH manquante" };
    }

    console.log("[SSH] Starting tunnel to", ssh.vpsHost);
    const status = await startTunnel({
      vpsHost: ssh.vpsHost,
      vpsPort: ssh.vpsPort || 22,
      sshUser: ssh.sshUser || "tunnel",
      privateKey: ssh.privateKey,
      remoteHost: "localhost",
      remotePort: ssh.remotePort || 3307,
    });

    // If tunnel connected, restart Next.js server with updated env vars
    if (status.state === "connected") {
      await restartNextServer();
    }

    return { success: status.state !== "error", status };
  });

  ipcMain.handle("tunnel-stop", async () => {
    stopTunnel();
    await restartNextServer();
    return { success: true };
  });

  ipcMain.handle("tunnel-status", () => {
    return getTunnelStatus();
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
      const subnets = getLocalSubnets();
      console.log("[scan] Subnets detected:", subnets);
      if (subnets.length === 0) {
        return { success: false, error: "Impossible de determiner le sous-reseau local", servers: [] };
      }

      let hostsWithPort: string[] = [];
      for (const subnet of subnets) {
        console.log(`[scan] Scanning ${subnet}.1-254 on port 3306...`);
        const hosts = await scanSubnetForPort(subnet, 3306, 2000);
        console.log(`[scan] ${subnet}: ${hosts.length} host(s) with port 3306:`, hosts);
        hostsWithPort = hostsWithPort.concat(hosts);
      }

      const db = store.get("db");
      const servers: Array<{ ip: string; articleCount: number }> = [];

      for (const ip of hostsWithPort) {
        try {
          console.log(`[scan] Testing MariaDB on ${ip}...`);
          const count = await testMariaDb(ip, db);
          servers.push({ ip, articleCount: count });
          console.log(`[scan] MariaDB OK on ${ip}: ${count} articles`);
        } catch (err) {
          console.log(`[scan] MariaDB failed on ${ip}:`, err instanceof Error ? err.message : String(err));
        }
      }

      console.log(`[scan] Result: ${hostsWithPort.length} port(s) open, ${servers.length} serveur(s) valide(s)`);
      return { success: true, subnet: subnets[0], hostsFound: hostsWithPort.length, servers };
    } catch (err) {
      console.error("[scan] Error:", err);
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
      await restartNextServer();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
}

async function restartNextServer() {
  stopNextServer();
  const dbEnv = getDbEnvVars();
  serverPort = await startNextServer(dbEnv);
  if (mainWindow) {
    mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);
  }
}

// ============================================================
// Network scanning utilities
// ============================================================

function findSystemNode(): string {
  const sep = process.platform === "win32" ? ";" : ":";
  const exe = process.platform === "win32" ? "node.exe" : "node";
  const dirs = process.env.PATH?.split(sep) ?? [];
  for (const dir of dirs) {
    try {
      const p = path.join(dir, exe);
      require("fs").accessSync(p, require("fs").constants.X_OK);
      return p;
    } catch { /* skip */ }
  }
  if (process.platform === "darwin") return "/opt/homebrew/bin/node";
  return "node";
}

async function queryDb(
  host: string,
  db: { port?: number; user?: string; password?: string; database?: string },
  sql: string
): Promise<Record<string, unknown>[]> {
  if (process.platform === "darwin") {
    return queryViaChildNode(host, db, sql);
  }

  const mysql2 = require("mysql2/promise");
  const conn = await mysql2.createConnection({
    host,
    port: db.port || 3306,
    user: db.user || "ginkoyes",
    password: db.password || "ginkoyes",
    database: db.database || "ginkoyes",
    connectTimeout: 5000,
  });
  const [rows] = await conn.execute(sql);
  await conn.end();
  return rows as Record<string, unknown>[];
}

async function queryViaChildNode(
  host: string,
  db: { port?: number; user?: string; password?: string; database?: string },
  sql: string
): Promise<Record<string, unknown>[]> {
  const script = [
    "const mysql = require('mysql2/promise');",
    "(async () => {",
    `  const conn = await mysql.createConnection({`,
    `    host: ${JSON.stringify(host)},`,
    `    port: ${db.port || 3306},`,
    `    user: ${JSON.stringify(db.user || "ginkoyes")},`,
    `    password: ${JSON.stringify(db.password || "ginkoyes")},`,
    `    database: ${JSON.stringify(db.database || "ginkoyes")},`,
    `    connectTimeout: 5000,`,
    `  });`,
    `  const [rows] = await conn.execute(${JSON.stringify(sql)});`,
    "  console.log(JSON.stringify(rows));",
    "  await conn.end();",
    "})().catch(e => { console.error(e.message); process.exit(1); });",
  ].join("\n");

  const { stdout, stderr } = await execFileAsync(
    findSystemNode(),
    ["--input-type=commonjs", "-e", script],
    { timeout: 10000, cwd: path.join(__dirname, "..") }
  );
  if (stderr?.trim()) throw new Error(stderr.trim());
  return JSON.parse(stdout.trim());
}

async function testMariaDb(
  host: string,
  db: { port?: number; user?: string; password?: string; database?: string }
): Promise<number> {
  const rows = await queryDb(host, db, "SELECT COUNT(*) AS count FROM ARTARTICLE");
  return (rows[0]?.count as number) ?? 0;
}

function getLocalSubnets(): string[] {
  const subnets: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const addrs = interfaces[name];
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === "IPv4" && !addr.internal) {
        const parts = addr.address.split(".");
        const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
        if (!subnets.includes(subnet)) {
          subnets.push(subnet);
        }
      }
    }
  }
  return subnets;
}

function checkPort(host: string, port: number, timeoutSec: number): Promise<boolean> {
  if (process.platform === "darwin") {
    return execAsync(`/usr/bin/nc -z -G ${timeoutSec} ${host} ${port}`, {
      timeout: (timeoutSec + 1) * 1000,
    }).then(() => true, () => false);
  }
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutSec * 1000);
    socket.on("connect", () => { socket.destroy(); resolve(true); });
    socket.on("timeout", () => { socket.destroy(); resolve(false); });
    socket.on("error", () => { socket.destroy(); resolve(false); });
    socket.connect(port, host);
  });
}

async function scanSubnetForPort(subnet: string, port: number, _timeout: number): Promise<string[]> {
  const results: string[] = [];
  const timeoutSec = 2;
  const batchSize = 50;
  for (let start = 1; start <= 254; start += batchSize) {
    const end = Math.min(start + batchSize - 1, 254);
    const batch: Promise<void>[] = [];
    for (let i = start; i <= end; i++) {
      const ip = `${subnet}.${i}`;
      batch.push(
        checkPort(ip, port, timeoutSec).then((open) => {
          if (open) {
            console.log(`[scan] Port ${port} OPEN on ${ip}`);
            results.push(ip);
          }
        })
      );
    }
    await Promise.all(batch);
    console.log(`[scan] Scanned ${subnet}.${start}-${end}`);
  }
  return results;
}

// ============================================================
// App lifecycle
// ============================================================

app.whenReady().then(async () => {
  setupIpcHandlers();
  createMenu();

  // Start SSH tunnel if enabled — MUST await before starting Next.js
  // so that the tunnel port is available in env vars
  const sshCfg = store.get("ssh");
  if (sshCfg.enabled && sshCfg.vpsHost && sshCfg.privateKey) {
    try {
      await startTunnel({
        vpsHost: sshCfg.vpsHost,
        vpsPort: sshCfg.vpsPort || 22,
        sshUser: sshCfg.sshUser || "tunnel",
        privateKey: sshCfg.privateKey,
        remoteHost: "localhost",
        remotePort: sshCfg.remotePort || 3307,
      });
    } catch {
      // Tunnel start failed — LAN-only mode, non-fatal
    }
  }

  // Start Next.js with DB config as env vars (tunnel port now available)
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

app.on("before-quit", async () => {
  stopTunnel();
  stopNextServer();
});
