import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, execFile } from 'child_process';
import * as mysql from 'mysql2/promise';

// --- Config ---

interface SyncConfig {
  mariadb: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  interbase?: {
    ibSourcePath?: string;
    ibLocalPath?: string;
    isqlPath?: string;
    interbaseHome?: string;
    user?: string;
    password?: string;
  };
  network?: {
    share?: string;
    user?: string;
    password?: string;
  };
  sync: {
    batchSize?: number;
    logPath: string;
    schedule?: string;
    liveSchedule?: string;
    liveEnabled?: boolean;
  };
}

const SPORTLINK_DIR = 'C:\\sportlink-serveur';

function getConfigPath(): string {
  // 1. C:\sportlink-serveur (deploye)
  const deployed = path.join(SPORTLINK_DIR, 'sync-config.json');
  if (fs.existsSync(deployed)) return deployed;

  // 2. Resources Electron (bundled)
  const bundled = path.join(process.resourcesPath, 'sync', 'sync-config.json');
  if (fs.existsSync(bundled)) return bundled;

  // 3. Dev : repertoire parent (sync/)
  const devPath = path.join(__dirname, '..', '..', 'sync', 'sync-config.json');
  if (fs.existsSync(devPath)) return devPath;

  return deployed;
}

function loadConfig(): SyncConfig {
  const configPath = getConfigPath();
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw);
}

function getInstallDir(): string {
  // 1. C:\sportlink-serveur (deploye)
  if (fs.existsSync(path.join(SPORTLINK_DIR, 'sync-config.json'))) return SPORTLINK_DIR;
  // 2. Resources Electron (bundled)
  if (fs.existsSync(path.join(process.resourcesPath, 'sync', 'sync-config.json'))) return path.join(process.resourcesPath, 'sync');
  // 3. Dev
  return path.join(__dirname, '..', '..');
}

function deployFiles(): void {
  if (!app.isPackaged) return;

  const syncDir = path.join(process.resourcesPath, 'sync');
  if (!fs.existsSync(syncDir)) return;

  // Creer C:\sportlink-serveur et sous-dossiers
  for (const dir of [SPORTLINK_DIR, path.join(SPORTLINK_DIR, 'dist'), path.join(SPORTLINK_DIR, 'logs'), path.join(SPORTLINK_DIR, 'sql')]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  // Copier sync-config.json (seulement si absent — ne pas ecraser la config utilisateur)
  const cfgDest = path.join(SPORTLINK_DIR, 'sync-config.json');
  if (!fs.existsSync(cfgDest)) {
    const cfgSrc = path.join(syncDir, 'sync-config.json');
    if (fs.existsSync(cfgSrc)) fs.copyFileSync(cfgSrc, cfgDest);
  }

  // Copier sync dist (toujours mettre a jour)
  const distSrc = path.join(syncDir, 'dist');
  if (fs.existsSync(distSrc)) {
    for (const file of fs.readdirSync(distSrc)) {
      fs.copyFileSync(path.join(distSrc, file), path.join(SPORTLINK_DIR, 'dist', file));
    }
  }

  // Copier SQL (toujours mettre a jour)
  const sqlSrc = path.join(process.resourcesPath, 'sql');
  if (fs.existsSync(sqlSrc)) {
    for (const file of fs.readdirSync(sqlSrc)) {
      fs.copyFileSync(path.join(sqlSrc, file), path.join(SPORTLINK_DIR, 'sql', file));
    }
  }
}

// --- DB helper ---

async function dbQuery<T>(sql: string, params: any[] = []): Promise<T> {
  const config = loadConfig();
  const conn = await mysql.createConnection({
    host: config.mariadb.host,
    port: config.mariadb.port,
    user: config.mariadb.user,
    password: config.mariadb.password,
    database: config.mariadb.database,
  });
  try {
    const [rows] = await conn.execute(sql, params);
    return rows as T;
  } finally {
    await conn.end();
  }
}

// --- Window ---

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'SportLink Server',
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Charge index.html depuis renderer/
  const isDev = !app.isPackaged;
  const htmlPath = isDev
    ? path.join(__dirname, '..', 'renderer', 'index.html')
    : path.join(process.resourcesPath, 'renderer', 'index.html');

  if (!fs.existsSync(htmlPath)) {
    console.error(`[ERREUR] index.html introuvable: ${htmlPath}`);
    const fallbackHtml = `<html><body><h1>Erreur</h1><p>index.html introuvable: ${htmlPath}</p></body></html>`;
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fallbackHtml)}`);
  } else {
    mainWindow.loadFile(htmlPath);
  }

  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// --- IPC Handlers ---

let syncProcess: ReturnType<typeof spawn> | null = null;

function registerIpcHandlers(): void {
  // 1. get-sync-status : 5 derniers syncs
  ipcMain.handle('get-sync-status', async () => {
    try {
      return await dbQuery('SELECT * FROM _sync_meta ORDER BY id DESC LIMIT 5');
    } catch (err: any) {
      return { error: err.message };
    }
  });

  // 2. get-tunnel-config
  ipcMain.handle('get-tunnel-config', async () => {
    try {
      const rows = await dbQuery<any[]>(
        'SELECT vps_host, vps_port, ssh_user, private_key, remote_port FROM _vpn_config WHERE id = 1'
      );
      return rows[0] || null;
    } catch (err: any) {
      return { error: err.message };
    }
  });

  // 3. set-tunnel-config
  ipcMain.handle('set-tunnel-config', async (_event, config: { vps_host: string; vps_port: number; ssh_user: string; private_key: string; remote_port: number }) => {
    try {
      await dbQuery(
        `INSERT INTO _vpn_config (id, vps_host, vps_port, ssh_user, private_key, remote_port)
         VALUES (1, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           vps_host = VALUES(vps_host),
           vps_port = VALUES(vps_port),
           ssh_user = VALUES(ssh_user),
           private_key = VALUES(private_key),
           remote_port = VALUES(remote_port)`,
        [config.vps_host, config.vps_port, config.ssh_user, config.private_key, config.remote_port]
      );
      return { success: true };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  // 4. trigger-sync : lance node dist/sync.js et stream stdout
  ipcMain.handle('trigger-sync', async () => {
    if (syncProcess) {
      return { error: 'Une synchronisation est deja en cours' };
    }

    const sendLog = (msg: string) => {
      mainWindow?.webContents.send('sync-output', msg + '\n');
    };

    // Verifie qu'il n'y a pas de sync running en DB
    try {
      const rows = await dbQuery<any[]>(
        "SELECT id FROM _sync_meta WHERE status = 'running' LIMIT 1"
      );
      if (rows.length > 0) {
        return { error: 'Une synchronisation est deja en cours (status=running en base)' };
      }
    } catch (err: any) {
      sendLog(`[WARN] Impossible de verifier _sync_meta: ${err.message}`);
    }

    // Determine le repertoire d'installation
    const installDir = getInstallDir();
    sendLog(`[INFO] Repertoire d'installation: ${installDir}`);

    // Cherche le script sync.js
    const candidates = [
      path.join(installDir, 'dist', 'sync.js'),
      path.join(installDir, 'sync', 'dist', 'sync.js'),
    ];

    let syncScript: string | null = null;
    for (const candidate of candidates) {
      sendLog(`[INFO] Recherche sync.js: ${candidate} -> ${fs.existsSync(candidate) ? 'TROUVE' : 'absent'}`);
      if (fs.existsSync(candidate)) {
        syncScript = candidate;
        break;
      }
    }

    if (!syncScript) {
      // Liste les fichiers du repertoire pour diagnostic
      try {
        const files = fs.readdirSync(installDir);
        sendLog(`[DEBUG] Contenu de ${installDir}: ${files.join(', ')}`);
        const distDir = path.join(installDir, 'dist');
        if (fs.existsSync(distDir)) {
          const distFiles = fs.readdirSync(distDir);
          sendLog(`[DEBUG] Contenu de ${distDir}: ${distFiles.join(', ')}`);
        }
      } catch {}
      return { error: `Script sync.js introuvable dans ${installDir}` };
    }

    sendLog(`[INFO] Lancement: node ${syncScript}`);

    // Verifie que node est accessible
    let nodePath = 'node';
    try {
      const { execSync } = require('child_process');
      const nodeVersion = execSync('node --version', { timeout: 5000 }).toString().trim();
      sendLog(`[INFO] Node.js: ${nodeVersion}`);
    } catch {
      // node pas dans le PATH, essayer des chemins connus
      const knownPaths = [
        'C:\\Program Files\\nodejs\\node.exe',
        'C:\\Program Files (x86)\\nodejs\\node.exe',
      ];
      let found = false;
      for (const np of knownPaths) {
        if (fs.existsSync(np)) {
          nodePath = np;
          found = true;
          sendLog(`[INFO] Node.js trouve: ${np}`);
          break;
        }
      }
      if (!found) {
        sendLog(`[ERREUR] Node.js introuvable dans le PATH et dans les chemins connus`);
        return { error: 'Node.js introuvable. Verifiez que Node.js est installe.' };
      }
    }

    // Build env with INTERBASE home if configured
    const spawnEnv: Record<string, string | undefined> = { ...process.env };
    try {
      const syncCfg = loadConfig();
      if (syncCfg.interbase?.interbaseHome) {
        spawnEnv.INTERBASE = syncCfg.interbase.interbaseHome;
        sendLog(`[INFO] INTERBASE env: ${syncCfg.interbase.interbaseHome}`);
      }
    } catch {}

    try {
      syncProcess = spawn(nodePath, [syncScript], {
        cwd: installDir,
        env: spawnEnv,
      });
    } catch (err: any) {
      sendLog(`[ERREUR] Impossible de lancer le processus: ${err.message}`);
      return { error: `Impossible de lancer sync: ${err.message}` };
    }

    syncProcess.stdout?.on('data', (data: Buffer) => {
      mainWindow?.webContents.send('sync-output', data.toString());
    });

    syncProcess.stderr?.on('data', (data: Buffer) => {
      mainWindow?.webContents.send('sync-output', `[ERREUR] ${data.toString()}`);
    });

    syncProcess.on('close', (code: number | null) => {
      sendLog(`[INFO] Processus sync termine (code: ${code})`);
      syncProcess = null;
      mainWindow?.webContents.send('sync-finished', code);
    });

    syncProcess.on('error', (err: Error) => {
      sendLog(`[ERREUR] Processus sync echoue: ${err.message}`);
      syncProcess = null;
      mainWindow?.webContents.send('sync-finished', 1);
    });

    return { success: true };
  });

  // 5. get-service-status : sc query SportLinkSync
  ipcMain.handle('get-service-status', async () => {
    return new Promise((resolve) => {
      execFile('sc', ['query', 'sportlinksync.exe'], (err, stdout, stderr) => {
        if (err) {
          resolve({ running: false, output: stderr || err.message });
          return;
        }
        const running = stdout.includes('RUNNING');
        resolve({ running, output: stdout });
      });
    });
  });

  // 6. get-sync-log : 200 dernieres lignes du log
  ipcMain.handle('get-sync-log', async () => {
    try {
      const config = loadConfig();
      const logPath = config.sync.logPath;
      if (!fs.existsSync(logPath)) {
        return { lines: [], error: `Fichier log introuvable: ${logPath}` };
      }
      const content = fs.readFileSync(logPath, 'utf-8');
      const allLines = content.split('\n');
      const lines = allLines.slice(-200);
      return { lines };
    } catch (err: any) {
      return { lines: [], error: err.message };
    }
  });

  // 7. get-sync-config : retourne le contenu complet de sync-config.json
  ipcMain.handle('get-sync-config', async () => {
    try {
      const configPath = getConfigPath();
      if (!fs.existsSync(configPath)) {
        return { error: 'sync-config.json introuvable' };
      }
      const raw = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(raw);
    } catch (err: any) {
      return { error: err.message };
    }
  });

  // 8. save-sync-config : merge partiel dans sync-config.json
  ipcMain.handle('save-sync-config', async (_event, partial: Partial<SyncConfig>) => {
    try {
      const configPath = getConfigPath();
      let existing: any = {};
      if (fs.existsSync(configPath)) {
        existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }

      // Merge each section
      if (partial.interbase) {
        existing.interbase = { ...existing.interbase, ...partial.interbase };
      }
      if (partial.network) {
        existing.network = { ...existing.network, ...partial.network };
      }
      if (partial.sync) {
        existing.sync = { ...existing.sync, ...partial.sync };
      }

      const json = JSON.stringify(existing, null, 2);
      fs.writeFileSync(configPath, json, 'utf-8');

      // Also write to dist/sync-config.json if it exists
      const distConfig = path.join(path.dirname(configPath), 'dist', 'sync-config.json');
      if (fs.existsSync(path.dirname(distConfig))) {
        fs.writeFileSync(distConfig, json, 'utf-8');
      }

      return { success: true };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  // 9. test-path-exists : verifie si un chemin existe + retourne info
  ipcMain.handle('test-path-exists', async (_event, filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { exists: false };
      }
      const stats = fs.statSync(filePath);
      return {
        exists: true,
        size: stats.size,
        mtime: stats.mtime.toISOString(),
      };
    } catch (err: any) {
      return { exists: false, error: err.message };
    }
  });

  // 10. browse-file : dialog natif pour choisir un fichier
  ipcMain.handle('browse-file', async (_event, options: { title?: string; filters?: { name: string; extensions: string[] }[] }) => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: options.title || 'Selectionner un fichier',
      filters: options.filters || [],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, filePath: result.filePaths[0] };
  });

  // 11. detect-interbase : scan des emplacements connus pour isql.exe
  ipcMain.handle('detect-interbase', async () => {
    const candidates = [
      'C:\\Embarcadero\\InterBase\\bin\\isql.exe',
      'C:\\Program Files\\Embarcadero\\InterBase\\bin\\isql.exe',
      'C:\\Program Files (x86)\\Embarcadero\\InterBase\\bin\\isql.exe',
      'C:\\InterBase\\bin\\isql.exe',
      'C:\\Program Files\\InterBase\\bin\\isql.exe',
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        // Derive interbaseHome from bin/isql.exe path
        const interbaseHome = path.dirname(path.dirname(candidate));
        return { found: true, isqlPath: candidate, interbaseHome };
      }
    }
    return { found: false };
  });

  // 12. check-setup-needed : true si pas de section interbase valide
  ipcMain.handle('check-setup-needed', async () => {
    try {
      const configPath = getConfigPath();
      if (!fs.existsSync(configPath)) {
        return { needed: true };
      }
      const raw = fs.readFileSync(configPath, 'utf-8');
      const cfg = JSON.parse(raw);
      // Setup needed if no interbase section or no ibSourcePath
      if (!cfg.interbase || !cfg.interbase.ibSourcePath) {
        return { needed: true };
      }
      return { needed: false };
    } catch {
      return { needed: true };
    }
  });

}

// --- App lifecycle ---

app.whenReady().then(() => {
  deployFiles();
  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (syncProcess) {
    syncProcess.kill();
    syncProcess = null;
  }
  app.quit();
});
