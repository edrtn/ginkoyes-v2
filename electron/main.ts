import { app, BrowserWindow, ipcMain, Menu } from "electron";
import path from "path";
import mysql from "mysql2/promise";
import store, { DbConfig } from "./store";
import { startNextServer, stopNextServer } from "./server";
import { setupAutoUpdater } from "./updater";

let mainWindow: BrowserWindow | null = null;
let serverPort: number | null = null;

// ============================================================
// Convert stored DB config to environment variables
// so that lib/config.ts (inside Next.js) can read them
// ============================================================

function getDbEnvVars(): Record<string, string> {
  const db = store.get("db");
  return {
    DB_LAN_HOST: db.lanHost || "127.0.0.1",
    DB_TAILSCALE_HOST: db.tailscaleHost || "",
    DB_PORT: String(db.port || 3306),
    DB_USER: db.user || "ginkoyes",
    DB_PASSWORD: db.password || "ginkoyes",
    DB_NAME: db.database || "ginkoyes",
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
}

// ============================================================
// App lifecycle
// ============================================================

app.whenReady().then(async () => {
  setupIpcHandlers();
  createMenu();

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
  stopNextServer();
});
