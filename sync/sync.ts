/**
 * SportLink Server — Script de synchronisation nightly
 *
 * Flux :
 * 1. Copie GBK depuis le partage réseau → local
 * 2. gbak -c pour restaurer SV.GBK → temp_sync.fdb
 * 3. Connexion Firebird au FDB temporaire
 * 4. Pour chaque table : TRUNCATE + INSERT batch dans MariaDB
 * 5. Mise à jour _sync_meta
 * 6. Suppression du FDB temporaire
 * 7. Logging dans fichier
 *
 * Usage CLI : npx tsx sync/sync.ts
 * Usage service : import { runSync } from './sync'
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as readline from "readline";
import mysql from "mysql2/promise";

// ============================================================
// Types
// ============================================================

export interface SyncConfig {
  firebird: {
    gbkSourcePath?: string;
    gbkLocalPath: string;
    /** @deprecated Use gbkLocalPath instead */
    gbkPath?: string;
    tempFdbPath: string;
    gbakPath: string;
    user: string;
    password: string;
  };
  network?: {
    share: string;
    user: string;
    password: string;
  };
  mariadb: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  sync: {
    batchSize: number;
    logPath: string;
    schedule?: string;
  };
}

export interface SyncResult {
  tablesSynced: number;
  totalRows: number;
  durationMs: number;
}

interface TableDef {
  name: string;
  columns: string[];
  where?: string; // filtre SQL optionnel (ex: date >= ...)
}

// ============================================================
// Logging
// ============================================================

function ensureLogDir(logPath: string) {
  const logDir = path.dirname(logPath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

function createLogger(logPath: string) {
  return (message: string) => {
    const timestamp = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris", hour12: false }).replace(",", "");
    const line = `[${timestamp}] ${message}`;
    console.log(line);
    try {
      ensureLogDir(logPath);
      fs.appendFileSync(logPath, line + "\n");
    } catch {
      // Ignore log write errors
    }
  };
}

// ============================================================
// Tables à synchroniser (dans l'ordre de dépendances FK)
// ============================================================

const TABLES: TableDef[] = [
  // Tier 1 : référentiels
  { name: "ARTMARQUE", columns: ["MRK_ID", "MRK_NOM"] },
  { name: "ARTGENRE", columns: ["GRE_ID", "GRE_NOM"] },
  { name: "NKLRAYON", columns: ["RAY_ID", "RAY_NOM"] },
  { name: "ARTCLASSEMENT", columns: ["CLA_ID", "CLA_NOM"] },
  { name: "ARTFOURN", columns: ["FOU_ID", "FOU_NOM"] },
  { name: "PLXTAILLESGF", columns: ["TGF_ID", "TGF_NOM", "TGF_CORRES"] },
  { name: "PLXCOULEUR", columns: ["COU_ID", "COU_NOM", "COU_CODE", "COU_ARTID"] },
  // Tier 2 : hiérarchie
  { name: "NKLFAMILLE", columns: ["FAM_ID", "FAM_NOM", "FAM_RAYID"] },
  { name: "NKLSSFAMILLE", columns: ["SSF_ID", "SSF_NOM", "SSF_FAMID"] },
  // Tier 3 : articles
  {
    name: "ARTARTICLE",
    columns: ["ART_ID", "ART_NOM", "ART_REFMRK", "ART_CODE", "ART_CODEFOURN", "ART_MRKID", "ART_GREID", "ART_SSFID"],
  },
  // Tier 4 : collections, tickets, BL (filtré 4 dernières années)
  { name: "ARTCOLLECTION", columns: ["COL_ID", "COL_NOM"] },
  { name: "CSHTICKET", columns: ["TKE_ID", "TKE_DATE", "TKE_NUMERO", "TKE_TOTALTTC"],
    where: "TKE_DATE >= '2022-01-01'" },
  { name: "NEGBL", columns: ["BLE_ID", "BLE_DATE", "BLE_NUMERO", "BLE_WEB"],
    where: "BLE_DATE >= '2022-01-01'" },
  // Tier 5 : références, stock, commandes, réceptions
  { name: "ARTREFERENCE", columns: ["ARF_ID", "ARF_ARTID", "ARF_CHRONO", "ARF_ICLID1"] },
  { name: "ARTCOLART", columns: ["CAR_ARTID", "CAR_COLID"] },
  { name: "AGRSTOCKCOUR", columns: ["STC_ARTID", "STC_TGFID", "STC_COUID", "STC_QTE", "STC_PUMP"] },
  { name: "COMBCDE", columns: ["CDE_ID", "CDE_COLID", "CDE_FOUID", "CDE_DATE"],
    where: "CDE_DATE >= '2022-01-01'" },
  {
    name: "RECBR",
    columns: ["BRE_ID", "BRE_DATE", "BRE_NUMERO", "BRE_NUMFOURN", "BRE_FOUID", "BRE_COLID"],
    where: "BRE_DATE >= '2022-01-01'",
  },
  // Tier 6 : lignes (filtré via jointure sur les tables parentes)
  { name: "ARTCLAITEM", columns: ["CIT_ICLID", "CIT_CLAID"] },
  { name: "ARTCODEBARRE", columns: ["CBI_ID", "CBI_CB", "CBI_ARFID"] },
  {
    name: "CSHTICKETL",
    columns: ["TKL_ID", "TKL_TKEID", "TKL_ARTID", "TKL_NOM", "TKL_QTE", "TKL_PXBRUT", "TKL_REMISE", "TKL_PXNET", "TKL_PXNNHT", "TKL_TGFID", "TKL_COUID"],
    where: "TKL_TKEID IN (SELECT TKE_ID FROM CSHTICKET WHERE TKE_DATE >= '2022-01-01')",
  },
  {
    name: "NEGBLL",
    columns: ["BLL_ID", "BLL_BLEID", "BLL_ARTID", "BLL_QTE", "BLL_PXBRUT", "BLL_PXNET", "BLL_PXNN", "BLL_TGFID", "BLL_COUID"],
    where: "BLL_BLEID IN (SELECT BLE_ID FROM NEGBL WHERE BLE_DATE >= '2022-01-01')",
  },
  {
    name: "COMBCDEL",
    columns: ["CDL_ID", "CDL_CDEID", "CDL_ARTID", "CDL_COUID", "CDL_TGFID", "CDL_QTE", "CDL_PXACHAT", "CDL_PXVENTE", "CDL_REMISE1", "CDL_REMISE2", "CDL_REMISE3"],
    where: "CDL_CDEID IN (SELECT CDE_ID FROM COMBCDE WHERE CDE_DATE >= '2022-01-01')",
  },
  {
    name: "RECBRL",
    columns: ["BRL_ID", "BRL_BREID", "BRL_ARTID", "BRL_QTE", "BRL_PXACHAT", "BRL_PXVENTE", "BRL_TGFID", "BRL_COUID"],
    where: "BRL_BREID IN (SELECT BRE_ID FROM RECBR WHERE BRE_DATE >= '2022-01-01')",
  },
  // Tier 7 : Clients & Atelier (SAV)
  { name: "CLTCLIENT", columns: ["CLT_ID", "CLT_NOM", "CLT_PRENOM", "CLT_NUMERO", "CLT_TELEPHONE", "CLT_TELPORTABLE", "CLT_EMAIL", "CLT_COMMENT"] },
  { name: "SAVMAT", columns: ["MAT_ID", "MAT_CLTID", "MAT_NOM", "MAT_SERIE", "MAT_COULEUR", "MAT_COMMENT", "MAT_DATEACHAT", "MAT_CHRONO", "MAT_NUMMARQUAGE"] },
  { name: "SAVFICHEE", columns: ["SAV_ID", "SAV_CLTID", "SAV_MATID", "SAV_CHRONO", "SAV_DTCREATION", "SAV_DEBUT", "SAV_FIN", "SAV_ETAT", "SAV_IDENT", "SAV_COMMENT", "SAV_DATEPRISEENCHARGE", "SAV_DATEPLANNING", "SAV_DATEREPRISE", "SAV_PLACE", "SAV_KILOMETRAGEVAE", "SAV_NEUF", "SAV_REMMO", "SAV_REMART", "SAV_REM"] },
  { name: "SAVFICHEL", columns: ["SAL_ID", "SAL_SAVID", "SAL_NOM", "SAL_COMMENT", "SAL_DUREE", "SAL_PXBRUT", "SAL_PXTOT", "SAL_REMISE", "SAL_TERMINE", "SAL_DATEDEBUT", "SAL_DATEFIN"] },
  { name: "SAVFICHEART", columns: ["SAA_ID", "SAA_SAVID", "SAA_SALID", "SAA_ARTID", "SAA_QTE", "SAA_PU", "SAA_PXTOT", "SAA_REMISE"] },
];

// ============================================================
// Config migration helper
// ============================================================

function getGbkLocalPath(cfg: SyncConfig): string {
  return cfg.firebird.gbkLocalPath || cfg.firebird.gbkPath || "";
}

// ============================================================
// Copy GBK from network share to local
// ============================================================

function mountNetworkShare(cfg: SyncConfig, log: (msg: string) => void): void {
  if (!cfg.network?.share) return;

  const { share, user, password } = cfg.network;
  try {
    // Disconnect first to avoid "already connected" errors
    try { execSync(`net use "${share}" /delete /y`, { stdio: "pipe" }); } catch {}
    const cmd = `net use "${share}" /user:${user} "${password}"`;
    execSync(cmd, { stdio: "pipe", timeout: 30_000 });
    log(`Partage réseau connecté : ${share}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Impossible de monter le partage ${share} : ${msg}`);
  }
}

function copyGbk(cfg: SyncConfig, log: (msg: string) => void): void {
  const { gbkSourcePath } = cfg.firebird;
  const gbkLocalPath = getGbkLocalPath(cfg);

  if (!gbkSourcePath) {
    log("Pas de gbkSourcePath configuré, utilisation directe du fichier local");
    return;
  }

  // Mount network share if credentials are configured
  mountNetworkShare(cfg, log);

  if (!fs.existsSync(gbkSourcePath)) {
    throw new Error(`Fichier source introuvable : ${gbkSourcePath}`);
  }

  // Créer le dossier de destination si nécessaire
  const destDir = path.dirname(gbkLocalPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  log(`Copie GBK : ${gbkSourcePath} → ${gbkLocalPath}`);
  const start = Date.now();
  fs.copyFileSync(gbkSourcePath, gbkLocalPath);
  const sizeMB = Math.round(fs.statSync(gbkLocalPath).size / 1024 / 1024);
  const durationSec = Math.round((Date.now() - start) / 1000);
  log(`Copie terminée : ${sizeMB} Mo en ${durationSec}s`);
}

// ============================================================
// Restore GBK → FDB temp
// ============================================================

function restoreGbk(cfg: SyncConfig, log: (msg: string) => void): void {
  const { gbakPath, tempFdbPath, user, password } = cfg.firebird;
  const gbkLocalPath = getGbkLocalPath(cfg);

  // Nettoyage du FDB temporaire précédent (peut être verrouillé par Firebird)
  if (fs.existsSync(tempFdbPath)) {
    try {
      fs.unlinkSync(tempFdbPath);
      log("Ancien FDB temporaire supprimé");
    } catch {
      // Fichier verrouillé — tenter renommage
      const oldPath = tempFdbPath + ".old";
      try {
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch {}
      try {
        fs.renameSync(tempFdbPath, oldPath);
        log("Ancien FDB temporaire renommé (.old)");
      } catch (renameErr) {
        log(`WARN: Impossible de supprimer/renommer le FDB temporaire: ${renameErr}`);
        log("Tentative de restauration par ecrasement...");
      }
    }
  }

  log(`Restauration GBK : ${gbkLocalPath} → ${tempFdbPath}`);
  // -REP pour écraser un FDB existant (si verrouillé et non supprimable)
  const replaceFlag = fs.existsSync(tempFdbPath) ? "-REP" : "-c";
  const cmd = `"${gbakPath}" ${replaceFlag} -FIX_FSS_METADATA WIN1252 -FIX_FSS_DATA WIN1252 -page_size 16384 -user ${user} -password ${password} "${gbkLocalPath}" "${tempFdbPath}"`;
  log(`gbak mode: ${replaceFlag}`);
  try {
    execSync(cmd, { stdio: "pipe", timeout: 43_200_000 }); // 12h max
  } catch (err: unknown) {
    // Si c'est un timeout ou SIGTERM, le FDB est incomplet → on le supprime
    const isTimeout = err instanceof Error && (
      (err as any).killed === true ||
      (err as any).signal === 'SIGTERM' ||
      err.message.includes('TIMEOUT') ||
      err.message.includes('timed out')
    );
    if (isTimeout) {
      if (fs.existsSync(tempFdbPath)) {
        fs.unlinkSync(tempFdbPath);
      }
      throw new Error(`gbak timeout : la restauration a depasse le delai maximum`);
    }
    // gbak returns exit code 1 for warnings (table attribute not recognized, etc.)
    // Check if the FDB file was actually created despite the warnings
    if (!fs.existsSync(tempFdbPath)) {
      throw err;
    }
    log("Restauration GBK terminée (avec warnings gbak)");
    return;
  }
  log("Restauration GBK terminée");
}

// ============================================================
// isql helper — extrait les données via CLI Firebird natif
// ============================================================

function getIsqlPath(gbakPath: string): string {
  return path.join(path.dirname(gbakPath), "isql.exe");
}

// ============================================================
// Sync one table (isql CLI + streaming parse)
// ============================================================

async function syncTable(
  cfg: SyncConfig,
  pool: mysql.Pool,
  table: TableDef,
  log: (msg: string) => void
): Promise<number> {
  const isqlPath = getIsqlPath(cfg.firebird.gbakPath);
  const tempDir = os.tmpdir();
  const tempSqlFile = path.join(tempDir, `gk_${table.name}.sql`);
  const tempOutFile = path.join(tempDir, `gk_${table.name}.out`);

  // Ecrire la requete SQL avec CONNECT (contourne le probleme d'auth CLI Firebird 4)
  const sqlContent = [
    `CONNECT '${cfg.firebird.tempFdbPath}' user '${cfg.firebird.user}' password '${cfg.firebird.password}';`,
    `SET LIST ON;`,
    `SELECT ${table.columns.join(", ")} FROM ${table.name}${table.where ? " WHERE " + table.where : ""};`,
    ``
  ].join("\n");
  fs.writeFileSync(tempSqlFile, sqlContent, "utf-8");

  // Executer isql (sans credentials CLI — le CONNECT dans le SQL gere l'auth)
  log(`  Extraction ${table.name} via isql...`);
  const cmd = `"${isqlPath}" -i "${tempSqlFile}" -o "${tempOutFile}" -ch UTF8`;

  try {
    execSync(cmd, { stdio: "pipe", timeout: 1_800_000 }); // 30 min max par table
  } catch (err: unknown) {
    if (!fs.existsSync(tempOutFile)) throw err;
    // Lire seulement les premiers 512 octets (pas tout le fichier !)
    const fdCheck = fs.openSync(tempOutFile, "r");
    const checkBuf = Buffer.alloc(512);
    fs.readSync(fdCheck, checkBuf, 0, 512, 0);
    fs.closeSync(fdCheck);
    const preview = checkBuf.toString("utf-8");
    if (preview.includes("Statement failed") || preview.includes("ERROR")) {
      log(`  ERREUR isql: ${preview.trim()}`);
      throw new Error(`isql failed for ${table.name}: ${preview.substring(0, 200)}`);
    }
    // isql retourne parfois code 1 pour des warnings — on continue
  }

  if (!fs.existsSync(tempOutFile)) {
    log(`  WARN: pas de fichier output pour ${table.name}, table vide`);
    await pool.execute("SET FOREIGN_KEY_CHECKS=0");
    await pool.execute(`TRUNCATE TABLE ${table.name}`);
    await pool.execute("SET FOREIGN_KEY_CHECKS=1");
    return 0;
  }

  // Verifier les erreurs isql (lire seulement le debut du fichier)
  const fd = fs.openSync(tempOutFile, "r");
  const headBuf = Buffer.alloc(512);
  fs.readSync(fd, headBuf, 0, 512, 0);
  fs.closeSync(fd);
  const head = headBuf.toString("utf-8");
  if (head.includes("Statement failed") || head.includes("not defined")) {
    log(`  ERREUR isql: ${head.trim()}`);
    try { fs.unlinkSync(tempSqlFile); } catch {}
    try { fs.unlinkSync(tempOutFile); } catch {}
    throw new Error(`isql failed for ${table.name}`);
  }

  // Parser le output et inserer dans MariaDB
  log(`  Insertion ${table.name} dans MariaDB...`);

  const fileSize = fs.statSync(tempOutFile).size;
  const conn = await pool.getConnection();
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS=0");
    await conn.query(`TRUNCATE TABLE ${table.name}`);

    const placeholders = table.columns.map(() => "?").join(", ");
    let rows = 0;
    let batch: (string | number | null)[][] = [];
    let currentRow: Record<string, string | null> = {};

    const flushBatch = async () => {
      if (batch.length === 0) return;
      const multi = batch.map(() => `(${placeholders})`).join(", ");
      await conn.query(
        `INSERT IGNORE INTO ${table.name} (${table.columns.join(", ")}) VALUES ${multi}`,
        batch.flat()
      );
      batch = [];
    };

    const parseLine = (line: string) => {
      const match = line.match(/^(\w+)\s{2,}(.*)$/);
      if (match) {
        const rawValue = match[2].trimEnd();
        currentRow[match[1]] = rawValue === "<null>" || rawValue === "" ? null : rawValue;
      } else if (line.trim() === "" && Object.keys(currentRow).length > 0) {
        batch.push(table.columns.map((col) => currentRow[col] ?? null));
        rows++;
        currentRow = {};
        return true; // row complete
      }
      return false;
    };

    if (fileSize < 400_000_000) {
      // Fichiers < 400MB : lecture synchrone (rapide, pas de race condition)
      const content = fs.readFileSync(tempOutFile, "utf-8");
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        parseLine(line);
        if (batch.length >= cfg.sync.batchSize) {
          await flushBatch();
          if (rows % 10000 === 0) log(`    ${table.name}: ${rows} lignes...`);
        }
      }
    } else {
      // Gros fichiers : lecture par chunks manuels (pas de readline, pas de fuite mémoire)
      log(`    (chunk mode, fichier ${Math.round(fileSize / 1024 / 1024)}MB)`);
      const CHUNK = 1024 * 1024; // 1MB
      const chunkBuf = Buffer.alloc(CHUNK);
      const fdRead = fs.openSync(tempOutFile, "r");
      let leftover = "";
      let bytesRead: number;
      let fileOffset = 0;

      while ((bytesRead = fs.readSync(fdRead, chunkBuf, 0, CHUNK, fileOffset)) > 0) {
        const chunk = leftover + chunkBuf.toString("utf-8", 0, bytesRead);
        const lines = chunk.split(/\r?\n/);
        leftover = lines.pop() || "";

        for (const line of lines) {
          parseLine(line);
          if (batch.length >= cfg.sync.batchSize) {
            await flushBatch();
            if (rows % 10000 === 0) log(`    ${table.name}: ${rows} lignes...`);
          }
        }
        fileOffset += bytesRead;
      }
      fs.closeSync(fdRead);
      if (leftover) parseLine(leftover);
    }

    // Dernier batch restant
    if (Object.keys(currentRow).length > 0) {
      batch.push(table.columns.map((col) => currentRow[col] ?? null));
      rows++;
    }
    await flushBatch();

    const totalRows = rows;

    await conn.execute("SET FOREIGN_KEY_CHECKS=1");
    log(`  ${totalRows} lignes inserees`);
    return totalRows;
  } finally {
    conn.release();
    try { fs.unlinkSync(tempSqlFile); } catch {}
    try { fs.unlinkSync(tempOutFile); } catch {}
  }
}

// ============================================================
// Cleanup
// ============================================================

function cleanupTempFdb(tempFdbPath: string, log: (msg: string) => void): void {
  if (!fs.existsSync(tempFdbPath)) return;

  // Essai 1 : suppression directe
  try {
    fs.unlinkSync(tempFdbPath);
    log("FDB temporaire supprimé");
    return;
  } catch {
    // Fichier verrouillé (Firebird le tient ouvert)
  }

  // Essai 2 : renommer puis supprimer (debloque parfois le lock)
  const renamed = tempFdbPath + ".old";
  try {
    if (fs.existsSync(renamed)) fs.unlinkSync(renamed);
  } catch {}
  try {
    fs.renameSync(tempFdbPath, renamed);
    fs.unlinkSync(renamed);
    log("FDB temporaire supprimé (après renommage)");
    return;
  } catch {}

  log("WARN: Impossible de supprimer le FDB temporaire (fichier verrouillé). Il sera écrasé au prochain sync.");
}

// ============================================================
// Main exported function
// ============================================================

export async function runSync(cfg: SyncConfig): Promise<SyncResult> {
  const log = createLogger(cfg.sync.logPath);
  const startTime = Date.now();
  log("=== Début de la synchronisation ===");

  const pool = mysql.createPool({
    host: cfg.mariadb.host,
    port: cfg.mariadb.port,
    user: cfg.mariadb.user,
    password: cfg.mariadb.password,
    database: cfg.mariadb.database,
    waitForConnections: true,
    connectionLimit: 5,
  });

  const [metaResult] = await pool.execute(
    "INSERT INTO _sync_meta (sync_start, status) VALUES (NOW(), 'running')"
  );
  const syncId = (metaResult as mysql.ResultSetHeader).insertId;

  try {
    // Step 1 : Copy GBK from network share (if configured)
    copyGbk(cfg, log);

    // Step 2 : Restore GBK
    restoreGbk(cfg, log);

    // Step 3 : Sync each table via isql CLI
    let totalRows = 0;
    let tablesSynced = 0;

    for (const table of TABLES) {
      try {
        const count = await syncTable(cfg, pool, table, log);
        totalRows += count;
        tablesSynced++;
        log(`  ✓ ${table.name} : ${count} lignes`);
      } catch (err) {
        log(`  ✗ ERREUR ${table.name} : ${err}`);
        throw err;
      }
    }

    // Step 4 : Refresh _ventes_daily summary table
    log("Rafraîchissement de _ventes_daily...");
    await pool.execute("CALL refresh_ventes_daily()");
    log("_ventes_daily rafraîchi ✓");

    // Step 5 : Update sync_meta (success)
    const durationMs = Date.now() - startTime;
    await pool.execute(
      "UPDATE _sync_meta SET sync_end = NOW(), status = 'success', tables_synced = ?, rows_synced = ?, duration_ms = ? WHERE id = ?",
      [tablesSynced, totalRows, durationMs, syncId]
    );

    log(`=== Synchronisation terminée : ${tablesSynced} tables, ${totalRows} lignes, ${durationMs}ms ===`);
    return { tablesSynced, totalRows, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    await pool.execute(
      "UPDATE _sync_meta SET sync_end = NOW(), status = 'error', error_message = ?, duration_ms = ? WHERE id = ?",
      [errorMsg, durationMs, syncId]
    );
    log(`=== ERREUR de synchronisation : ${errorMsg} ===`);
    throw err;
  } finally {
    cleanupTempFdb(cfg.firebird.tempFdbPath, log);
    await pool.end();
  }
}

// ============================================================
// CLI entry point
// ============================================================

if (require.main === module) {
  const configPath = path.join(__dirname, "sync-config.json");
  const cfg: SyncConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  runSync(cfg).catch((err) => {
    const log = createLogger(cfg.sync.logPath);
    log(`FATAL: ${err}`);
    process.exit(1);
  });
}
