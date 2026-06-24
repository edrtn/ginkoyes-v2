"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// sync/sync.ts
var sync_exports = {};
__export(sync_exports, {
  runSync: () => runSync
});
module.exports = __toCommonJS(sync_exports);
var import_child_process = require("child_process");
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var os = __toESM(require("os"));
var import_promise = __toESM(require("mysql2/promise"));
function ensureLogDir(logPath) {
  const logDir = path.dirname(logPath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}
function createLogger(logPath) {
  return (message) => {
    const timestamp = (/* @__PURE__ */ new Date()).toLocaleString("fr-FR", { timeZone: "Europe/Paris", hour12: false }).replace(",", "");
    const line = `[${timestamp}] ${message}`;
    console.log(line);
    try {
      ensureLogDir(logPath);
      fs.appendFileSync(logPath, line + "\n");
    } catch {
    }
  };
}
var TABLES = [
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
  {
    name: "CSHTICKET",
    columns: ["TKE_ID", "TKE_DATE", "TKE_NUMERO", "TKE_TOTALTTC"],
    strategy: "incremental",
    idColumn: "TKE_ID",
    dateColumn: "TKE_DATE",
    where: "TKE_DATE >= '2022-01-01'"
  },
  {
    name: "CSHTICKETL",
    columns: ["TKL_ID", "TKL_TKEID", "TKL_ARTID", "TKL_NOM", "TKL_QTE", "TKL_PXBRUT", "TKL_REMISE", "TKL_PXNET", "TKL_PXNNHT", "TKL_TGFID", "TKL_COUID"],
    strategy: "incremental",
    idColumn: "TKL_ID"
  },
  {
    name: "NEGBL",
    columns: ["BLE_ID", "BLE_DATE", "BLE_NUMERO", "BLE_WEB"],
    strategy: "incremental",
    idColumn: "BLE_ID",
    dateColumn: "BLE_DATE",
    where: "BLE_DATE >= '2022-01-01'"
  },
  {
    name: "NEGBLL",
    columns: ["BLL_ID", "BLL_BLEID", "BLL_ARTID", "BLL_QTE", "BLL_PXBRUT", "BLL_PXNET", "BLL_PXNN", "BLL_TGFID", "BLL_COUID"],
    strategy: "incremental",
    idColumn: "BLL_ID"
  },
  {
    name: "COMBCDE",
    columns: ["CDE_ID", "CDE_COLID", "CDE_FOUID", "CDE_DATE"],
    strategy: "incremental",
    idColumn: "CDE_ID",
    where: "CDE_DATE >= '2022-01-01'"
  },
  {
    name: "COMBCDEL",
    columns: ["CDL_ID", "CDL_CDEID", "CDL_ARTID", "CDL_COUID", "CDL_TGFID", "CDL_QTE", "CDL_PXACHAT", "CDL_PXVENTE", "CDL_REMISE1", "CDL_REMISE2", "CDL_REMISE3"],
    strategy: "incremental",
    idColumn: "CDL_ID"
  },
  {
    name: "RECBR",
    columns: ["BRE_ID", "BRE_DATE", "BRE_NUMERO", "BRE_NUMFOURN", "BRE_FOUID", "BRE_COLID"],
    strategy: "incremental",
    idColumn: "BRE_ID",
    where: "BRE_DATE >= '2022-01-01'"
  },
  {
    name: "RECBRL",
    columns: ["BRL_ID", "BRL_BREID", "BRL_ARTID", "BRL_QTE", "BRL_PXACHAT", "BRL_PXVENTE", "BRL_TGFID", "BRL_COUID"],
    strategy: "incremental",
    idColumn: "BRL_ID"
  },
  {
    name: "NEGRETOUR",
    columns: ["RTE_ID", "RTE_BLEID", "RTE_BLENUMERO", "RTE_DATE", "RTE_ETAT", "RTE_TYPE", "RTE_CLTID", "RTE_TKEID"],
    strategy: "incremental",
    idColumn: "RTE_ID",
    dateColumn: "RTE_DATE",
    where: "RTE_DATE >= '2022-01-01'"
  },
  {
    name: "NEGRETOURL",
    columns: ["RTL_ID", "RTL_RTEID", "RTL_BLLID", "RTL_QTERETOUR", "RTL_QTEREMBOURSEE", "RTL_PXVTE", "RTL_MOTIFCODE", "RTL_MOTIFLIBELLE", "RTL_EAN", "RTL_MRKCODE", "RTL_MODELCODESAP"],
    strategy: "incremental",
    idColumn: "RTL_ID"
  },
  {
    name: "AGRMOUVEMENT",
    columns: ["MVT_ID", "MVT_TYPE", "MVT_ARTID", "MVT_TGFID", "MVT_COUID", "MVT_DATE", "MVT_QTE", "MVT_PXUBRUT", "MVT_PXUNET", "MVT_SENS", "MVT_TYPID", "MVT_CLTID"],
    strategy: "incremental",
    idColumn: "MVT_ID",
    dateColumn: "MVT_DATE",
    where: "MVT_DATE >= '2022-01-01'"
  },
  // ── Stratégie D — Incrémental (SAV lignes) ──
  {
    name: "SAVMAT",
    columns: ["MAT_ID", "MAT_CLTID", "MAT_NOM", "MAT_SERIE", "MAT_COULEUR", "MAT_COMMENT", "MAT_DATEACHAT", "MAT_CHRONO", "MAT_NUMMARQUAGE"],
    strategy: "incremental",
    idColumn: "MAT_ID"
  },
  {
    name: "SAVFICHEL",
    columns: ["SAL_ID", "SAL_SAVID", "SAL_NOM", "SAL_COMMENT", "SAL_DUREE", "SAL_PXBRUT", "SAL_PXTOT", "SAL_REMISE", "SAL_TERMINE", "SAL_DATEDEBUT", "SAL_DATEFIN"],
    strategy: "incremental",
    idColumn: "SAL_ID"
  },
  {
    name: "SAVFICHEART",
    columns: ["SAA_ID", "SAA_SAVID", "SAA_SALID", "SAA_ARTID", "SAA_QTE", "SAA_PU", "SAA_PXTOT", "SAA_REMISE"],
    strategy: "incremental",
    idColumn: "SAA_ID"
  },
  {
    name: "SAVMATDETAIL",
    columns: ["MAD_ID", "MAD_MATID", "MAD_DESIGNATION", "MAD_VALUE", "MAD_COMMENT", "MAD_NUMBER", "MAD_BUYDATE", "MAD_WARRANTLY", "MAD_HS"],
    strategy: "incremental",
    idColumn: "MAD_ID"
  },
  {
    name: "SAVHISTO",
    columns: ["SAH_ID", "SAH_SAVID", "SAH_EVENT", "SAH_DATE", "SAH_VALUEBEFORE", "SAH_VALUEAFTER", "SAH_USER"],
    strategy: "incremental",
    idColumn: "SAH_ID"
  },
  {
    name: "SAVFICHEPC",
    columns: ["SPC_ID", "SPC_PCEID", "SPC_PCLID", "SPC_SAVID"],
    strategy: "incremental",
    idColumn: "SPC_ID"
  }
];
function getGbkLocalPath(cfg) {
  return cfg.firebird.gbkLocalPath || cfg.firebird.gbkPath || "";
}
function mountNetworkShare(cfg, log) {
  if (!cfg.network?.share) return;
  const { share, user, password } = cfg.network;
  try {
    try {
      (0, import_child_process.execSync)(`net use "${share}" /delete /y`, { stdio: "pipe" });
    } catch {
    }
    const cmd = `net use "${share}" /user:${user} "${password}"`;
    (0, import_child_process.execSync)(cmd, { stdio: "pipe", timeout: 3e4 });
    log(`Partage r\xE9seau connect\xE9 : ${share}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Impossible de monter le partage ${share} : ${msg}`);
  }
}
function copyGbk(cfg, log) {
  const { gbkSourcePath } = cfg.firebird;
  const gbkLocalPath = getGbkLocalPath(cfg);
  if (!gbkSourcePath) {
    log("Pas de gbkSourcePath configur\xE9, utilisation directe du fichier local");
    return;
  }
  mountNetworkShare(cfg, log);
  if (!fs.existsSync(gbkSourcePath)) {
    throw new Error(`Fichier source introuvable : ${gbkSourcePath}`);
  }
  const destDir = path.dirname(gbkLocalPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  log(`Copie GBK : ${gbkSourcePath} \u2192 ${gbkLocalPath}`);
  const start = Date.now();
  fs.copyFileSync(gbkSourcePath, gbkLocalPath);
  const sizeMB = Math.round(fs.statSync(gbkLocalPath).size / 1024 / 1024);
  const durationSec = Math.round((Date.now() - start) / 1e3);
  log(`Copie termin\xE9e : ${sizeMB} Mo en ${durationSec}s`);
}
function restoreGbk(cfg, log) {
  const { gbakPath, tempFdbPath, user, password } = cfg.firebird;
  const gbkLocalPath = getGbkLocalPath(cfg);
  if (fs.existsSync(tempFdbPath)) {
    try {
      fs.unlinkSync(tempFdbPath);
      log("Ancien FDB temporaire supprim\xE9");
    } catch {
      const oldPath = tempFdbPath + ".old";
      try {
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch {
      }
      try {
        fs.renameSync(tempFdbPath, oldPath);
        log("Ancien FDB temporaire renomm\xE9 (.old)");
      } catch (renameErr) {
        log(`WARN: Impossible de supprimer/renommer le FDB temporaire: ${renameErr}`);
        log("Tentative de restauration par ecrasement...");
      }
    }
  }
  log(`Restauration GBK : ${gbkLocalPath} \u2192 ${tempFdbPath}`);
  const replaceFlag = fs.existsSync(tempFdbPath) ? "-REP" : "-c";
  const cmd = `"${gbakPath}" ${replaceFlag} -FIX_FSS_METADATA WIN1252 -FIX_FSS_DATA WIN1252 -page_size 16384 -user ${user} -password ${password} "${gbkLocalPath}" "${tempFdbPath}"`;
  log(`gbak mode: ${replaceFlag}`);
  try {
    (0, import_child_process.execSync)(cmd, { stdio: "pipe", timeout: 432e5 });
  } catch (err) {
    const isTimeout = err instanceof Error && (err.killed === true || err.signal === "SIGTERM" || err.message.includes("TIMEOUT") || err.message.includes("timed out"));
    if (isTimeout) {
      if (fs.existsSync(tempFdbPath)) {
        fs.unlinkSync(tempFdbPath);
      }
      throw new Error(`gbak timeout : la restauration a depasse le delai maximum`);
    }
    if (!fs.existsSync(tempFdbPath)) {
      throw err;
    }
    log("Restauration GBK termin\xE9e (avec warnings gbak)");
    return;
  }
  log("Restauration GBK termin\xE9e");
}
function getIsqlPath(cfg) {
  if (cfg.firebird.isqlPath) return cfg.firebird.isqlPath;
  return path.join(path.dirname(cfg.firebird.gbakPath), "isql.exe");
}
async function ensureSyncProgressTable(pool) {
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
async function getLastMaxId(pool, tableName) {
  const [rows] = await pool.execute(
    "SELECT last_max_id FROM _sync_progress WHERE table_name = ?",
    [tableName]
  );
  const result = rows;
  return result.length > 0 ? Number(result[0].last_max_id) : 0;
}
async function updateSyncProgress(pool, tableName, idColumn, maxId, rowsSynced) {
  await pool.execute(
    `INSERT INTO _sync_progress (table_name, id_column, last_max_id, last_sync_at, rows_synced)
     VALUES (?, ?, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE last_max_id = VALUES(last_max_id), last_sync_at = NOW(), rows_synced = VALUES(rows_synced)`,
    [tableName, idColumn, maxId, rowsSynced]
  );
}
async function syncTable(cfg, pool, table, forceFull, log) {
  const isIncremental = table.strategy === "incremental" && !forceFull && !!table.idColumn;
  let lastMaxId = 0;
  if (isIncremental) {
    lastMaxId = await getLastMaxId(pool, table.name);
    log(`  [INCREMENTAL] ${table.name} \u2014 last_max_id = ${lastMaxId}`);
  } else {
    log(`  [FULL] ${table.name}`);
  }
  const isqlPath = getIsqlPath(cfg);
  const tempDir = os.tmpdir();
  const tempSqlFile = path.join(tempDir, `gk_${table.name}.sql`);
  const tempOutFile = path.join(tempDir, `gk_${table.name}.out`);
  const whereParts = [];
  if (isIncremental && table.idColumn) {
    whereParts.push(`${table.idColumn} > ${lastMaxId}`);
  }
  if (table.where && !isIncremental) {
    whereParts.push(table.where);
  }
  const whereClause = whereParts.length > 0 ? " WHERE " + whereParts.join(" AND ") : "";
  const sqlContent = [
    `CONNECT '${cfg.firebird.tempFdbPath}' user '${cfg.firebird.user}' password '${cfg.firebird.password}';`,
    `SET LIST ON;`,
    `SELECT ${table.columns.join(", ")} FROM ${table.name}${whereClause};`,
    ``
  ].join("\n");
  fs.writeFileSync(tempSqlFile, sqlContent, "utf-8");
  log(`  Extraction ${table.name} via isql...`);
  const cmd = `"${isqlPath}" -i "${tempSqlFile}" -o "${tempOutFile}" -ch UTF8`;
  try {
    (0, import_child_process.execSync)(cmd, { stdio: "pipe", timeout: 72e5 });
  } catch (err) {
    if (!fs.existsSync(tempOutFile)) throw err;
    const fdCheck = fs.openSync(tempOutFile, "r");
    const checkBuf = Buffer.alloc(512);
    fs.readSync(fdCheck, checkBuf, 0, 512, 0);
    fs.closeSync(fdCheck);
    const preview = checkBuf.toString("utf-8");
    if (preview.includes("Statement failed") || preview.includes("ERROR")) {
      log(`  ERREUR isql: ${preview.trim()}`);
      throw new Error(`isql failed for ${table.name}: ${preview.substring(0, 200)}`);
    }
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
  const fd = fs.openSync(tempOutFile, "r");
  const headBuf = Buffer.alloc(512);
  fs.readSync(fd, headBuf, 0, 512, 0);
  fs.closeSync(fd);
  const head = headBuf.toString("utf-8");
  if (head.includes("Statement failed") || head.includes("not defined")) {
    log(`  ERREUR isql: ${head.trim()}`);
    try {
      fs.unlinkSync(tempSqlFile);
    } catch {
    }
    try {
      fs.unlinkSync(tempOutFile);
    } catch {
    }
    throw new Error(`isql failed for ${table.name}`);
  }
  log(`  Insertion ${table.name} dans MariaDB...`);
  const fileSize = fs.statSync(tempOutFile).size;
  const conn = await pool.getConnection();
  let earliestDate = null;
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS=0");
    if (!isIncremental) {
      await conn.query(`TRUNCATE TABLE ${table.name}`);
    }
    const placeholders = table.columns.map(() => "?").join(", ");
    let rows = 0;
    let batch = [];
    let currentRow = {};
    const flushBatch = async () => {
      if (batch.length === 0) return;
      const multi = batch.map(() => `(${placeholders})`).join(", ");
      await conn.query(
        `INSERT IGNORE INTO ${table.name} (${table.columns.join(", ")}) VALUES ${multi}`,
        batch.flat()
      );
      batch = [];
    };
    const parseLine = (line) => {
      const match = line.match(/^(\w+)\s{2,}(.*)$/);
      if (match) {
        const rawValue = match[2].trimEnd();
        currentRow[match[1]] = rawValue === "<null>" || rawValue === "" ? null : rawValue;
      } else if (line.trim() === "" && Object.keys(currentRow).length > 0) {
        if (table.dateColumn && currentRow[table.dateColumn]) {
          const dateVal = currentRow[table.dateColumn].substring(0, 10);
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
    if (fileSize < 4e8) {
      const content = fs.readFileSync(tempOutFile, "utf-8");
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        parseLine(line);
        if (batch.length >= cfg.sync.batchSize) {
          await flushBatch();
          if (rows % 1e4 === 0) log(`    ${table.name}: ${rows} lignes...`);
        }
      }
    } else {
      log(`    (chunk mode, fichier ${Math.round(fileSize / 1024 / 1024)}MB)`);
      const CHUNK = 1024 * 1024;
      const chunkBuf = Buffer.alloc(CHUNK);
      const fdRead = fs.openSync(tempOutFile, "r");
      let leftover = "";
      let bytesRead;
      let fileOffset = 0;
      while ((bytesRead = fs.readSync(fdRead, chunkBuf, 0, CHUNK, fileOffset)) > 0) {
        const chunk = leftover + chunkBuf.toString("utf-8", 0, bytesRead);
        const lines = chunk.split(/\r?\n/);
        leftover = lines.pop() || "";
        for (const line of lines) {
          parseLine(line);
          if (batch.length >= cfg.sync.batchSize) {
            await flushBatch();
            if (rows % 1e4 === 0) log(`    ${table.name}: ${rows} lignes...`);
          }
        }
        fileOffset += bytesRead;
      }
      fs.closeSync(fdRead);
      if (leftover) parseLine(leftover);
    }
    if (Object.keys(currentRow).length > 0) {
      if (table.dateColumn && currentRow[table.dateColumn]) {
        const dateVal = currentRow[table.dateColumn].substring(0, 10);
        if (!earliestDate || dateVal < earliestDate) {
          earliestDate = dateVal;
        }
      }
      batch.push(table.columns.map((col) => currentRow[col] ?? null));
      rows++;
    }
    await flushBatch();
    await conn.execute("SET FOREIGN_KEY_CHECKS=1");
    if (table.idColumn) {
      if (isIncremental && rows > 0) {
        const [maxRows] = await conn.execute(
          `SELECT MAX(${table.idColumn}) AS max_id FROM ${table.name}`
        );
        const newMaxId = Number(maxRows[0]?.max_id ?? lastMaxId);
        await updateSyncProgress(pool, table.name, table.idColumn, newMaxId, rows);
        log(`  ${rows} nouvelles lignes (max_id: ${lastMaxId} \u2192 ${newMaxId})`);
      } else if (forceFull && rows > 0) {
        const [maxRows] = await conn.execute(
          `SELECT MAX(${table.idColumn}) AS max_id FROM ${table.name}`
        );
        const newMaxId = Number(maxRows[0]?.max_id ?? 0);
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
    try {
      fs.unlinkSync(tempSqlFile);
    } catch {
    }
    try {
      fs.unlinkSync(tempOutFile);
    } catch {
    }
  }
}
function cleanupTempFdb(tempFdbPath, log) {
  if (!fs.existsSync(tempFdbPath)) return;
  try {
    fs.unlinkSync(tempFdbPath);
    log("FDB temporaire supprim\xE9");
    return;
  } catch {
  }
  const renamed = tempFdbPath + ".old";
  try {
    if (fs.existsSync(renamed)) fs.unlinkSync(renamed);
  } catch {
  }
  try {
    fs.renameSync(tempFdbPath, renamed);
    fs.unlinkSync(renamed);
    log("FDB temporaire supprim\xE9 (apr\xE8s renommage)");
    return;
  } catch {
  }
  log("WARN: Impossible de supprimer le FDB temporaire (fichier verrouill\xE9). Il sera \xE9cras\xE9 au prochain sync.");
}
async function runSync(cfg, forceFull = false) {
  const log = createLogger(cfg.sync.logPath);
  const mode = forceFull ? "FULL" : "INCREMENTAL";
  const startTime = Date.now();
  log(`=== D\xE9but de la synchronisation [${mode}] ===`);
  const pool = import_promise.default.createPool({
    host: cfg.mariadb.host,
    port: cfg.mariadb.port,
    user: cfg.mariadb.user,
    password: cfg.mariadb.password,
    database: cfg.mariadb.database,
    waitForConnections: true,
    connectionLimit: 5
  });
  await ensureSyncProgressTable(pool);
  const [metaResult] = await pool.execute(
    "INSERT INTO _sync_meta (sync_start, status) VALUES (NOW(), 'running')"
  );
  const syncId = metaResult.insertId;
  try {
    copyGbk(cfg, log);
    restoreGbk(cfg, log);
    let totalRows = 0;
    let tablesSynced = 0;
    let globalEarliestDate = null;
    for (const table of TABLES) {
      try {
        const result = await syncTable(cfg, pool, table, forceFull, log);
        totalRows += result.rows;
        tablesSynced++;
        if (result.earliestDate) {
          if (!globalEarliestDate || result.earliestDate < globalEarliestDate) {
            globalEarliestDate = result.earliestDate;
          }
        }
        log(`  \u2713 ${table.name} : ${result.rows} lignes`);
      } catch (err) {
        log(`  \u2717 ERREUR ${table.name} : ${err}`);
        throw err;
      }
    }
    if (forceFull || !globalEarliestDate) {
      log("Rafra\xEEchissement complet de _ventes_daily...");
      await pool.execute("CALL refresh_ventes_daily()");
      log("_ventes_daily rafra\xEEchi (full) \u2713");
    } else {
      log(`Rafra\xEEchissement incr\xE9mental de _ventes_daily depuis ${globalEarliestDate}...`);
      await pool.execute("CALL refresh_ventes_daily_since(?)", [globalEarliestDate]);
      log(`_ventes_daily rafra\xEEchi (depuis ${globalEarliestDate}) \u2713`);
    }
    const durationMs = Date.now() - startTime;
    await pool.execute(
      "UPDATE _sync_meta SET sync_end = NOW(), status = 'success', tables_synced = ?, rows_synced = ?, duration_ms = ? WHERE id = ?",
      [tablesSynced, totalRows, durationMs, syncId]
    );
    log(`=== Synchronisation termin\xE9e [${mode}] : ${tablesSynced} tables, ${totalRows} lignes, ${Math.round(durationMs / 1e3)}s ===`);
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
if (require.main === module) {
  const forceFull = process.argv.includes("--full");
  const configPath = path.join(__dirname, "sync-config.json");
  const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  runSync(cfg, forceFull).catch((err) => {
    const log = createLogger(cfg.sync.logPath);
    log(`FATAL: ${err}`);
    process.exit(1);
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runSync
});
