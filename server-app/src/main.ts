import { app, BrowserWindow, ipcMain } from 'electron';
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
  sync: {
    logPath: string;
  };
}

function getConfigPath(): string {
  // En prod : meme repertoire que l'exe
  const exeDir = path.dirname(process.execPath);
  const configInExeDir = path.join(exeDir, 'sync-config.json');
  if (fs.existsSync(configInExeDir)) return configInExeDir;

  // Fallback : C:\Ginkoyes
  const fallback = 'C:\\Ginkoyes\\sync-config.json';
  if (fs.existsSync(fallback)) return fallback;

  // Dev : repertoire parent (sync/)
  const devPath = path.join(__dirname, '..', '..', 'sync', 'sync-config.json');
  if (fs.existsSync(devPath)) return devPath;

  return configInExeDir; // retourne le chemin par defaut meme si absent
}

function loadConfig(): SyncConfig {
  const configPath = getConfigPath();
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw);
}

function getInstallDir(): string {
  const exeDir = path.dirname(process.execPath);
  if (fs.existsSync(path.join(exeDir, 'sync-config.json'))) return exeDir;
  if (fs.existsSync('C:\\Ginkoyes\\sync-config.json')) return 'C:\\Ginkoyes';
  return path.join(__dirname, '..', '..');
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
    title: 'Ginkoyes Serveur',
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

  // 2. get-vpn-config
  ipcMain.handle('get-vpn-config', async () => {
    try {
      const rows = await dbQuery<any[]>('SELECT * FROM _vpn_config WHERE id = 1');
      return rows[0] || null;
    } catch (err: any) {
      return { error: err.message };
    }
  });

  // 3. set-vpn-key
  ipcMain.handle('set-vpn-key', async (_event, authKey: string) => {
    try {
      await dbQuery(
        'UPDATE _vpn_config SET auth_key = ? WHERE id = 1',
        [authKey]
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

    try {
      syncProcess = spawn(nodePath, [syncScript], {
        cwd: installDir,
        env: { ...process.env },
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

  // 5. get-service-status : sc query GinkoyesSync
  ipcMain.handle('get-service-status', async () => {
    return new Promise((resolve) => {
      execFile('sc', ['query', 'ginkoyessync.exe'], (err, stdout, stderr) => {
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

  // 7. tailscale-status
  ipcMain.handle('tailscale-status', async () => {
    return new Promise((resolve) => {
      execFile('tailscale', ['status', '--json'], (err, stdout) => {
        if (err) {
          resolve({ connected: false, error: err.message });
          return;
        }
        try {
          const data = JSON.parse(stdout);
          resolve({
            connected: data.BackendState === 'Running',
            ip: data.TailscaleIPs?.[0] || null,
            hostname: data.Self?.HostName || null,
            raw: data,
          });
        } catch {
          resolve({ connected: false, error: 'Impossible de parser la reponse Tailscale' });
        }
      });
    });
  });

  // 8. tailscale-up
  ipcMain.handle('tailscale-up', async (_event, authKey: string) => {
    return new Promise((resolve) => {
      const args = ['up'];
      if (authKey) args.push(`--auth-key=${authKey}`);
      execFile('tailscale', args, (err, stdout, stderr) => {
        if (err) {
          resolve({ success: false, error: stderr || err.message });
          return;
        }
        resolve({ success: true, output: stdout });
      });
    });
  });

  // 9. tailscale-down
  ipcMain.handle('tailscale-down', async () => {
    return new Promise((resolve) => {
      execFile('tailscale', ['down'], (err, stdout, stderr) => {
        if (err) {
          resolve({ success: false, error: stderr || err.message });
          return;
        }
        resolve({ success: true, output: stdout });
      });
    });
  });
}

// --- App lifecycle ---

app.whenReady().then(() => {
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
