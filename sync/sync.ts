/**
 * SportLink Server — Script de synchronisation nightly
 *
 * Flux :
 * 1. Copie GBK depuis le partage réseau → local
 * 2. gbak -c pour restaurer SV.GBK → temp_sync.fdb
 * 3. Connexion Firebird au FDB temporaire
 * 4. Pour chaque table : sync selon stratégie (full ou incrémental)
 * 5. Mise à jour _sync_meta + _sync_progress
 * 6. Suppression du FDB temporaire
 * 7. Logging dans fichier
 *
 * Usage CLI :
 *   node dist/sync.js          → mode incrémental (par défaut)
 *   node dist/sync.js --full   → mode full (TRUNCATE tout)
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
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
    /** Path to isql executable (if different from gbakPath directory) */
    isqlPath?: string;
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
  mode: "full" | "incremental";
}

type SyncStrategy = "full" | "incremental";

interface TableDef {
  name: string;
  columns: string[];
  strategy: SyncStrategy;
  idColumn?: string;     // PK column for incremental sync
  dateColumn?: string;   // date column to track earliest new date (for ventes_daily)
  where?: string;        // static SQL filter (e.g. date >= '2022-01-01')
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
  // ── Stratégie A — Full (petits référentiels) ──
  { name: "ARTMARQUE", columns: ["MRK_ID", "MRK_NOM"], strategy: "full" },
  { name: "ARTGENRE", columns: ["GRE_ID", "GRE_NOM"], strategy: "full" },
  { name: "NKLRAYON", columns: ["RAY_ID", "RAY_NOM"], strategy: "full" },
  { name: "ARTCLASSEMENT", columns: ["CLA_ID", "CLA_NOM"], strategy: "full" },
  { name: "ARTFOURN", columns: ["FOU_ID", "FOU_NOM"], strategy: "full" },
  { name: "PLXTAILLESGF", columns: ["TGF_ID", "TGF_NOM", "TGF_CORRES"], strategy: "full" },
  { name: "PLXCOULEUR", columns: ["COU_ID", "COU_NOM", "COU_CODE", "COU_ARTID"], strategy: "full" },
  { name: "NKLFAMILLE", columns: ["FAM_ID", "FAM_NOM", "FAM_RAYID"], strategy: "full" },
  { name: "NKLSSFAMILLE", columns: ["SSF_ID", "SSF_NOM", "SSF_FAMID"], strategy: "full" },
  { name: "ARTCOLLECTION", columns: ["COL_ID", "COL_NOM"], strategy: "full" },
  { name: "ARTCOLART", columns: ["CAR_ARTID", "CAR_COLID"], strategy: "full" },
  { name: "ARTCLAITEM", columns: ["CIT_ICLID", "CIT_CLAID"], strategy: "full" },
  { name: "ARTCODEBARRE", columns: ["CBI_ID", "CBI_CB", "CBI_ARFID"], strategy: "full" },

  // ── Stratégie B — Full (état courant, pas append-only) ──
  { name: "ARTARTICLE", columns: ["ART_ID", "ART_NOM", "ART_REFMRK", "ART_CODE", "ART_CODEFOURN", "ART_MRKID", "ART_GREID", "ART_SSFID"], strategy: "full" },
  { name: "ARTREFERENCE", columns: ["ARF_ID", "ARF_ARTID", "ARF_CHRONO", "ARF_ICLID1"], strategy: "full" },
  { name: "AGRSTOCKCOUR", columns: ["STC_ARTID", "STC_TGFID", "STC_COUID", "STC_QTE", "STC_PUMP"], strategy: "full" },
  { name: "CLTCLIENT", columns: ["CLT_ID", "CLT_NOM", "CLT_PRENOM", "CLT_NUMERO", "CLT_CIVID", "CLT_NAISSANCE", "CLT_TYPE", "CLT_TELEPHONE", "CLT_TELTRAVAIL_FAX", "CLT_TELPORTABLE", "CLT_EMAIL", "CLT_COMMENT", "CLT_PREMIERPASS", "CLT_DERNIERPASS", "CLT_OPINSMS", "CLT_OPTINEMAIL", "CLT_ARCHIVE"], strategy: "full" },
  { name: "SAVFICHEE", columns: ["SAV_ID", "SAV_CLTID", "SAV_MATID", "SAV_CHRONO", "SAV_DTCREATION", "SAV_DEBUT", "SAV_FIN", "SAV_ETAT", "SAV_IDENT", "SAV_COMMENT", "SAV_DATEPRISEENCHARGE", "SAV_DATEPLANNING", "SAV_DATEREPRISE", "SAV_PLACE", "SAV_KILOMETRAGEVAE", "SAV_NEUF", "SAV_REMMO", "SAV_REMART", "SAV_REM"], strategy: "full" },

  // SAV référentiels (full, petites tables)
  { name: "SAVTYPE", columns: ["STY_ID", "STY_NOM"], strategy: "full" },
  { name: "SAVTYPMAT", columns: ["TYM_ID", "TYM_NOM"], strategy: "full" },
  { name: "SAVRAYON", columns: ["SVR_ID", "SVR_NOM", "SVR_ORDRE", "SVR_ENABLED"], strategy: "full" },
  { name: "SAVTAUXH", columns: ["TXH_ID", "TXH_NOM", "TXH_PRIX"], strategy: "full" },
  { name: "SAVFORFAIT", columns: ["FOR_ID", "FOR_NOM", "FOR_PRIX", "FOR_DUREE"], strategy: "full" },
  { name: "SAVFORFAITL", columns: ["FOL_ID", "FOL_ARTID", "FOL_TGFID", "FOL_COUID", "FOL_QTE", "FOL_FORID"], strategy: "full" },

  // ── Stratégie C — Incrémental (transactions) ──
  { name: "CSHTICKET", columns: ["TKE_ID", "TKE_DATE", "TKE_NUMERO", "TKE_TOTALTTC"],
    strategy: "incremental", idColumn: "TKE_ID", dateColumn: "TKE_DATE",
    where: "TKE_DATE >= '2022-01-01'" },
  { name: "CSHTICKETL", columns: ["TKL_ID", "TKL_TKEID", "TKL_ARTID", "TKL_NOM", "TKL_QTE", "TKL_PXBRUT", "TKL_REMISE", "TKL_PXNET", "TKL_PXNNHT", "TKL_TGFID", "TKL_COUID"],
    strategy: "incremental", idColumn: "TKL_ID" },
  { name: "NEGBL", columns: ["BLE_ID", "BLE_DATE", "BLE_NUMERO", "BLE_WEB"],
    strategy: "incremental", idColumn: "BLE_ID", dateColumn: "BLE_DATE",
    where: "BLE_DATE >= '2022-01-01'" },
  { name: "NEGBLL", columns: ["BLL_ID", "BLL_BLEID", "BLL_ARTID", "BLL_QTE", "BLL_PXBRUT", "BLL_PXNET", "BLL_PXNN", "BLL_TGFID", "BLL_COUID"],
    strategy: "incremental", idColumn: "BLL_ID" },
  { name: "COMBCDE", columns: ["CDE_ID", "CDE_COLID", "CDE_FOUID", "CDE_DATE"],
    strategy: "incremental", idColumn: "CDE_ID",
    where: "CDE_DATE >= '2022-01-01'" },
  { name: "COMBCDEL", columns: ["CDL_ID", "CDL_CDEID", "CDL_ARTID", "CDL_COUID", "CDL_TGFID", "CDL_QTE", "CDL_PXACHAT", "CDL_PXVENTE", "CDL_REMISE1", "CDL_REMISE2", "CDL_REMISE3"],
    strategy: "incremental", idColumn: "CDL_ID" },
  { name: "RECBR", columns: ["BRE_ID", "BRE_DATE", "BRE_NUMERO", "BRE_NUMFOURN", "BRE_FOUID", "BRE_COLID"],
    strategy: "incremental", idColumn: "BRE_ID",
    where: "BRE_DATE >= '2022-01-01'" },
  { name: "RECBRL", columns: ["BRL_ID", "BRL_BREID", "BRL_ARTID", "BRL_QTE", "BRL_PXACHAT", "BRL_PXVENTE", "BRL_TGFID", "BRL_COUID"],
    strategy: "incremental", idColumn: "BRL_ID" },
  { name: "NEGRETOUR", columns: ["RTE_ID", "RTE_BLEID", "RTE_BLENUMERO", "RTE_DATE", "RTE_ETAT", "RTE_TYPE", "RTE_CLTID", "RTE_TKEID"],
    strategy: "incremental", idColumn: "RTE_ID", dateColumn: "RTE_DATE",
    where: "RTE_DATE >= '2022-01-01'" },
  { name: "NEGRETOURL", columns: ["RTL_ID", "RTL_RTEID", "RTL_BLLID", "RTL_QTERETOUR", "RTL_QTEREMBOURSEE", "RTL_PXVTE", "RTL_MOTIFCODE", "RTL_MOTIFLIBELLE", "RTL_EAN", "RTL_MRKCODE", "RTL_MODELCODESAP"],
    strategy: "incremental", idColumn: "RTL_ID" },
  { name: "AGRMOUVEMENT", columns: ["MVT_ID", "MVT_TYPE", "MVT_ARTID", "MVT_TGFID", "MVT_COUID", "MVT_DATE", "MVT_QTE", "MVT_PXUBRUT", "MVT_PXUNET", "MVT_SENS", "MVT_TYPID", "MVT_CLTID"],
    strategy: "incremental", idColumn: "MVT_ID", dateColumn: "MVT_DATE",
    where: "MVT_DATE >= '2022-01-01'" },

  // ── Stratégie D — Incrémental (SAV lignes) ──
  { name: "SAVMAT", columns: ["MAT_ID", "MAT_CLTID", "MAT_NOM", "MAT_SERIE", "MAT_COULEUR", "MAT_COMMENT", "MAT_DATEACHAT", "MAT_CHRONO", "MAT_NUMMARQUAGE"],
    strategy: "incremental", idColumn: "MAT_ID" },
  { name: "SAVFICHEL", columns: ["SAL_ID", "SAL_SAVID", "SAL_NOM", "SAL_COMMENT", "SAL_DUREE", "SAL_PXBRUT", "SAL_PXTOT", "SAL_REMISE", "SAL_TERMINE", "SAL_DATEDEBUT", "SAL_DATEFIN"],
    strategy: "incremental", idColumn: "SAL_ID" },
  { name: "SAVFICHEART", columns: ["SAA_ID", "SAA_SAVID", "SAA_SALID", "SAA_ARTID", "SAA_QTE", "SAA_PU", "SAA_PXTOT", "SAA_REMISE"],
    strategy: "incremental", idColumn: "SAA_ID" },
  { name: "SAVMATDETAIL", columns: ["MAD_ID", "MAD_MATID", "MAD_DESIGNATION", "MAD_VALUE", "MAD_COMMENT", "MAD_NUMBER", "MAD_BUYDATE", "MAD_WARRANTLY", "MAD_HS"],
    strategy: "incremental", idColumn: "MAD_ID" },
  { name: "SAVHISTO", columns: ["SAH_ID", "SAH_SAVID", "SAH_EVENT", "SAH_DATE", "SAH_VALUEBEFORE", "SAH_VALUEAFTER", "SAH_USER"],
    strategy: "incremental", idColumn: "SAH_ID" },
  { name: "SAVFICHEPC", columns: ["SPC_ID", "SPC_PCEID", "SPC_PCLID", "SPC_SAVID"],
    strategy: "incremental", idColumn: "SPC_ID" },
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

function getIsqlPath(cfg: SyncConfig): string {
  if (cfg.firebird.isqlPath) return cfg.firebird.isqlPath;
  return path.join(path.dirname(cfg.firebird.gbakPath), "isql.exe");
}

// ============================================================
// _sync_progress helpers
// ============================================================

async function ensureSyncProgressTable(pool: mysql.Pool): Promise<void> {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS _sync_progress (
      table_name   VARCHAR(64)   NOT NULL PRIMARY KEY,
      id_column    VARCHAR(64)   NOT NULL,
      last_max_id  BIGINT        NOT NULL DEFAULT 0,
      last_sync_at DATETIME      DEFAULT NULL,
      rows_synced  BIGINT        NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function getLastMaxId(pool: mysql.Pool, tableName: string): Promise<number> {
  const [rows] = await pool.execute(
    "SELECT last_max_id FROM _sync_progress WHERE table_name = ?",
    [tableName]
  );
  const result = rows as any[];
  return result.length > 0 ? Number(result[0].last_max_id) : 0;
}

async function updateSyncProgress(
  pool: mysql.Pool,
  tableName: string,
  idColumn: string,
  maxId: number,
  rowsSynced: number
): Promise<void> {
  await pool.execute(
    `INSERT INTO _sync_progress (table_name, id_column, last_max_id, last_sync_at, rows_synced)
     VALUES (?, ?, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE last_max_id = VALUES(last_max_id), last_sync_at = NOW(), rows_synced = VALUES(rows_synced)`,
    [tableName, idColumn, maxId, rowsSynced]
  );
}

// ============================================================
// Sync one table (isql CLI + streaming parse)
// ============================================================

interface SyncTableResult {
  rows: number;
  earliestDate: string | null; // YYYY-MM-DD or null
}

async function syncTable(
  cfg: SyncConfig,
  pool: mysql.Pool,
  table: TableDef,
  forceFull: boolean,
  log: (msg: string) => void
): Promise<SyncTableResult> {
  const isIncremental = table.strategy === "incremental" && !forceFull && !!table.idColumn;
  let lastMaxId = 0;

  if (isIncremental) {
    lastMaxId = await getLastMaxId(pool, table.name);
    log(`  [INCREMENTAL] ${table.name} — last_max_id = ${lastMaxId}`);
  } else {
    log(`  [FULL] ${table.name}`);
  }

  const isqlPath = getIsqlPath(cfg);
  const tempDir = os.tmpdir();
  const tempSqlFile = path.join(tempDir, `gk_${table.name}.sql`);
  const tempOutFile = path.join(tempDir, `gk_${table.name}.out`);

  // Build WHERE clause
  const whereParts: string[] = [];
  if (isIncremental && table.idColumn) {
    whereParts.push(`${table.idColumn} > ${lastMaxId}`);
  }
  if (table.where && !isIncremental) {
    // Static date filters only apply in full mode (incremental uses ID-based filtering)
    whereParts.push(table.where);
  }
  const whereClause = whereParts.length > 0 ? " WHERE " + whereParts.join(" AND ") : "";

  // Ecrire la requete SQL avec CONNECT
  const sqlContent = [
    `CONNECT '${cfg.firebird.tempFdbPath}' user '${cfg.firebird.user}' password '${cfg.firebird.password}';`,
    `SET LIST ON;`,
    `SELECT ${table.columns.join(", ")} FROM ${table.name}${whereClause};`,
    ``
  ].join("\n");
  fs.writeFileSync(tempSqlFile, sqlContent, "utf-8");

  // Executer isql
  log(`  Extraction ${table.name} via isql...`);
  const cmd = `"${isqlPath}" -i "${tempSqlFile}" -o "${tempOutFile}" -ch UTF8`;

  try {
    execSync(cmd, { stdio: "pipe", timeout: 7_200_000 }); // 2h max par table
  } catch (err: unknown) {
    if (!fs.existsSync(tempOutFile)) throw err;
    // Lire seulement les premiers 512 octets
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
    if (!isIncremental) {
      log(`  WARN: pas de fichier output pour ${table.name}, table vide`);
      await pool.execute("SET FOREIGN_KEY_CHECKS=0");
      await pool.execute(`TRUNCATE TABLE ${table.name}`);
      await pool.execute("SET FOREIGN_KEY_CHECKS=1");
    } else {
      log(`  ${table.name}: aucune nouvelle ligne`);
    }
    return { rows: 0, earliestDate: null };
  }

  // Verifier les erreurs isql
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
  let earliestDate: string | null = null;

  try {
    await conn.query("SET FOREIGN_KEY_CHECKS=0");

    // TRUNCATE only in full mode
    if (!isIncremental) {
      await conn.query(`TRUNCATE TABLE ${table.name}`);
    }

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
        // Track earliest date for ventes_daily incremental refresh
        if (table.dateColumn && currentRow[table.dateColumn]) {
          const dateVal = currentRow[table.dateColumn]!.substring(0, 10); // YYYY-MM-DD
          if (!earliestDate || dateVal < earliestDate) {
            earliestDate = dateVal;
          }
        }
        batch.push(table.columns.map((col) => currentRow[col] ?? null));
        rows++;
        currentRow = {};
        return true;
      }
      return false;
    };

    if (fileSize < 400_000_000) {
      // Fichiers < 400MB : lecture synchrone
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
      // Gros fichiers : lecture par chunks
      log(`    (chunk mode, fichier ${Math.round(fileSize / 1024 / 1024)}MB)`);
      const CHUNK = 1024 * 1024;
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
      if (table.dateColumn && currentRow[table.dateColumn]) {
        const dateVal: string = currentRow[table.dateColumn]!.substring(0, 10);
        if (!earliestDate || dateVal < (earliestDate as string)) {
          earliestDate = dateVal;
        }
      }
      batch.push(table.columns.map((col) => currentRow[col] ?? null));
      rows++;
    }
    await flushBatch();

    await conn.execute("SET FOREIGN_KEY_CHECKS=1");

    // Update _sync_progress for incremental tables
    if (table.idColumn) {
      if (isIncremental && rows > 0) {
        // Get the new MAX(id) from MariaDB after insert
        const [maxRows] = await conn.execute(
          `SELECT MAX(${table.idColumn}) AS max_id FROM ${table.name}`
        );
        const newMaxId = Number((maxRows as any[])[0]?.max_id ?? lastMaxId);
        await updateSyncProgress(pool, table.name, table.idColumn, newMaxId, rows);
        log(`  ${rows} nouvelles lignes (max_id: ${lastMaxId} → ${newMaxId})`);
      } else if (forceFull && rows > 0) {
        // After full sync, seed _sync_progress with current MAX
        const [maxRows] = await conn.execute(
          `SELECT MAX(${table.idColumn}) AS max_id FROM ${table.name}`
        );
        const newMaxId = Number((maxRows as any[])[0]?.max_id ?? 0);
        await updateSyncProgress(pool, table.name, table.idColumn, newMaxId, rows);
      } else if (isIncremental && rows === 0) {
        log(`  Aucune nouvelle ligne`);
      }
    }

    if (!isIncremental || !table.idColumn) {
      log(`  ${rows} lignes inserees`);
    }

    return { rows, earliestDate };
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

  // Essai 2 : renommer puis supprimer
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

export async function runSync(cfg: SyncConfig, forceFull = false): Promise<SyncResult> {
  const log = createLogger(cfg.sync.logPath);
  const mode = forceFull ? "FULL" : "INCREMENTAL";
  const startTime = Date.now();
  log(`=== Début de la synchronisation [${mode}] ===`);

  const pool = mysql.createPool({
    host: cfg.mariadb.host,
    port: cfg.mariadb.port,
    user: cfg.mariadb.user,
    password: cfg.mariadb.password,
    database: cfg.mariadb.database,
    waitForConnections: true,
    connectionLimit: 5,
  });

  // Ensure _sync_progress table exists (idempotent)
  await ensureSyncProgressTable(pool);

  const [metaResult] = await pool.execute(
    "INSERT INTO _sync_meta (sync_start, status) VALUES (NOW(), 'running')"
  );
  const syncId = (metaResult as mysql.ResultSetHeader).insertId;

  try {
    // Step 1 : Copy GBK from network share (if configured)
    copyGbk(cfg, log);

    // Step 2 : Restore GBK
    restoreGbk(cfg, log);

    // Step 3 : Sync each table
    let totalRows = 0;
    let tablesSynced = 0;
    let globalEarliestDate: string | null = null;

    for (const table of TABLES) {
      try {
        const result = await syncTable(cfg, pool, table, forceFull, log);
        totalRows += result.rows;
        tablesSynced++;

        // Track earliest date across all tables with dateColumn
        if (result.earliestDate) {
          if (!globalEarliestDate || result.earliestDate < globalEarliestDate) {
            globalEarliestDate = result.earliestDate;
          }
        }

        log(`  ✓ ${table.name} : ${result.rows} lignes`);
      } catch (err) {
        log(`  ✗ ERREUR ${table.name} : ${err}`);
        throw err;
      }
    }

    // Step 4 : Refresh _ventes_daily
    if (forceFull || !globalEarliestDate) {
      // Full refresh
      log("Rafraîchissement complet de _ventes_daily...");
      await pool.execute("CALL refresh_ventes_daily()");
      log("_ventes_daily rafraîchi (full) ✓");
    } else {
      // Incremental refresh — only re-compute dates with new data
      log(`Rafraîchissement incrémental de _ventes_daily depuis ${globalEarliestDate}...`);
      await pool.execute("CALL refresh_ventes_daily_since(?)", [globalEarliestDate]);
      log(`_ventes_daily rafraîchi (depuis ${globalEarliestDate}) ✓`);
    }

    // Step 5 : Update sync_meta (success)
    const durationMs = Date.now() - startTime;
    await pool.execute(
      "UPDATE _sync_meta SET sync_end = NOW(), status = 'success', tables_synced = ?, rows_synced = ?, duration_ms = ? WHERE id = ?",
      [tablesSynced, totalRows, durationMs, syncId]
    );

    log(`=== Synchronisation terminée [${mode}] : ${tablesSynced} tables, ${totalRows} lignes, ${Math.round(durationMs / 1000)}s ===`);
    return { tablesSynced, totalRows, durationMs, mode: forceFull ? "full" : "incremental" };
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
  const forceFull = process.argv.includes("--full");
  const configPath = path.join(__dirname, "sync-config.json");
  const cfg: SyncConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  runSync(cfg, forceFull).catch((err) => {
    const log = createLogger(cfg.sync.logPath);
    log(`FATAL: ${err}`);
    process.exit(1);
  });
}
