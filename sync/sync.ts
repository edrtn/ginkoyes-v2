/**
 * Ginkoyes V2 — Script de synchronisation nightly
 *
 * Flux :
 * 1. gbak -c pour restaurer SV.GBK → temp_sync.fdb
 * 2. Connexion Firebird au FDB temporaire
 * 3. Pour chaque table : TRUNCATE + INSERT batch dans MariaDB
 * 4. Mise à jour _sync_meta
 * 5. Suppression du FDB temporaire
 * 6. Logging dans fichier
 *
 * Usage : npx tsx sync/sync.ts
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import Firebird from "node-firebird";
import mysql from "mysql2/promise";

// ============================================================
// Configuration
// ============================================================

const configPath = path.join(__dirname, "sync-config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

// ============================================================
// Logging
// ============================================================

function ensureLogDir() {
  const logDir = path.dirname(config.sync.logPath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

function log(message: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;
  console.log(line);
  try {
    ensureLogDir();
    fs.appendFileSync(config.sync.logPath, line + "\n");
  } catch {
    // Ignore log write errors
  }
}

// ============================================================
// Tables à synchroniser (dans l'ordre de dépendances FK)
// ============================================================

interface TableDef {
  name: string;
  columns: string[];
}

const TABLES: TableDef[] = [
  // Tier 1 : référentiels
  {
    name: "ARTMARQUE",
    columns: ["MRK_ID", "MRK_NOM"],
  },
  {
    name: "ARTGENRE",
    columns: ["GRE_ID", "GRE_NOM"],
  },
  {
    name: "NKLRAYON",
    columns: ["RAY_ID", "RAY_NOM"],
  },
  {
    name: "ARTCLASSEMENT",
    columns: ["CLA_ID", "CLA_NOM"],
  },
  {
    name: "ARTFOURN",
    columns: ["FOU_ID", "FOU_NOM"],
  },
  {
    name: "PLXTAILLESGF",
    columns: ["TGF_ID", "TGF_NOM", "TGF_CORRES"],
  },
  {
    name: "PLXCOULEUR",
    columns: ["COU_ID", "COU_NOM", "COU_CODE", "COU_ARTID"],
  },
  // Tier 2 : hiérarchie
  {
    name: "NKLFAMILLE",
    columns: ["FAM_ID", "FAM_NOM", "FAM_RAYID"],
  },
  {
    name: "NKLSSFAMILLE",
    columns: ["SSF_ID", "SSF_NOM", "SSF_FAMID"],
  },
  // Tier 3 : articles
  {
    name: "ARTARTICLE",
    columns: [
      "ART_ID",
      "ART_NOM",
      "ART_REFMRK",
      "ART_CODE",
      "ART_CODEFOURN",
      "ART_MRKID",
      "ART_GREID",
      "ART_SSFID",
    ],
  },
  // Tier 4 : collections, tickets, BL
  {
    name: "ARTCOLLECTION",
    columns: ["COL_ID", "COL_NOM"],
  },
  {
    name: "CSHTICKET",
    columns: ["TKE_ID", "TKE_DATE", "TKE_NUMERO", "TKE_TOTALTTC"],
  },
  {
    name: "NEGBL",
    columns: ["BLE_ID", "BLE_DATE", "BLE_NUMERO", "BLE_WEB"],
  },
  // Tier 5 : références, stock, commandes, réceptions
  {
    name: "ARTREFERENCE",
    columns: ["ARF_ID", "ARF_ARTID", "ARF_CHRONO", "ARF_ICLID1"],
  },
  {
    name: "ARTCOLART",
    columns: ["CAR_ARTID", "CAR_COLID"],
  },
  {
    name: "AGRSTOCKCOUR",
    columns: ["STC_ARTID", "STC_TGFID", "STC_COUID", "STC_QTE", "STC_PUMP"],
  },
  {
    name: "COMBCDE",
    columns: ["CDE_ID", "CDE_COLID", "CDE_FOUID", "CDE_DATE"],
  },
  {
    name: "RECBR",
    columns: [
      "BRE_ID",
      "BRE_DATE",
      "BRE_NUMERO",
      "BRE_NUMFOURN",
      "BRE_FOUID",
      "BRE_COLID",
    ],
  },
  // Tier 6 : lignes
  {
    name: "ARTCLAITEM",
    columns: ["CIT_ICLID", "CIT_CLAID"],
  },
  {
    name: "ARTCODEBARRE",
    columns: ["CBI_ID", "CBI_CB", "CBI_ARFID"],
  },
  {
    name: "CSHTICKETL",
    columns: [
      "TKL_ID",
      "TKL_TKEID",
      "TKL_ARTID",
      "TKL_NOM",
      "TKL_QTE",
      "TKL_PXBRUT",
      "TKL_REMISE",
      "TKL_PXNET",
      "TKL_PXNNHT",
      "TKL_TGFID",
      "TKL_COUID",
    ],
  },
  {
    name: "NEGBLL",
    columns: [
      "BLL_ID",
      "BLL_BLEID",
      "BLL_ARTID",
      "BLL_QTE",
      "BLL_PXBRUT",
      "BLL_PXNET",
      "BLL_PXNN",
      "BLL_TGFID",
      "BLL_COUID",
    ],
  },
  {
    name: "COMBCDEL",
    columns: [
      "CDL_ID",
      "CDL_CDEID",
      "CDL_ARTID",
      "CDL_COUID",
      "CDL_TGFID",
      "CDL_QTE",
      "CDL_PXACHAT",
      "CDL_PXVENTE",
      "CDL_REMISE1",
      "CDL_REMISE2",
      "CDL_REMISE3",
    ],
  },
  {
    name: "RECBRL",
    columns: [
      "BRL_ID",
      "BRL_BREID",
      "BRL_ARTID",
      "BRL_QTE",
      "BRL_PXACHAT",
      "BRL_PXVENTE",
      "BRL_TGFID",
      "BRL_COUID",
    ],
  },
];

// ============================================================
// Step 1 : Restore GBK → FDB temp
// ============================================================

function restoreGbk(): void {
  const { gbakPath, gbkPath, tempFdbPath, user, password } = config.firebird;

  // Remove old temp FDB if exists
  if (fs.existsSync(tempFdbPath)) {
    fs.unlinkSync(tempFdbPath);
    log("Ancien FDB temporaire supprimé");
  }

  log(`Restauration GBK : ${gbkPath} → ${tempFdbPath}`);
  const cmd = `"${gbakPath}" -c -user ${user} -password ${password} "${gbkPath}" "${tempFdbPath}"`;
  execSync(cmd, { stdio: "pipe", timeout: 600_000 }); // 10 min timeout
  log("Restauration GBK terminée");
}

// ============================================================
// Step 2 : Query Firebird temp FDB
// ============================================================

function queryFirebird(
  fbOptions: Firebird.Options,
  sql: string
): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    Firebird.attach(fbOptions, (err, db) => {
      if (err) return reject(err);
      db.query(sql, [], (err, result) => {
        db.detach();
        if (err) return reject(err);
        resolve((result || []) as Record<string, unknown>[]);
      });
    });
  });
}

// ============================================================
// Step 3 : Sync one table
// ============================================================

async function syncTable(
  fbOptions: Firebird.Options,
  pool: mysql.Pool,
  table: TableDef
): Promise<number> {
  const selectSql = `SELECT ${table.columns.join(", ")} FROM ${table.name}`;
  log(`  Lecture ${table.name} depuis Firebird...`);
  const rows = await queryFirebird(fbOptions, selectSql);
  log(`  ${rows.length} lignes lues`);

  if (rows.length === 0) {
    await pool.execute(`TRUNCATE TABLE ${table.name}`);
    return 0;
  }

  const conn = await pool.getConnection();
  try {
    await conn.execute("SET FOREIGN_KEY_CHECKS=0");
    await conn.execute(`TRUNCATE TABLE ${table.name}`);

    const placeholders = table.columns.map(() => "?").join(", ");
    const insertSql = `INSERT INTO ${table.name} (${table.columns.join(", ")}) VALUES (${placeholders})`;

    // Batch insert
    const batchSize = config.sync.batchSize;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values = batch.map((row) =>
        table.columns.map((col) => {
          const val = row[col];
          // Convert Firebird dates to ISO strings for MariaDB
          if (val instanceof Date) {
            return val.toISOString().slice(0, 10);
          }
          return val ?? null;
        })
      );

      // Use batch insert with multiple value sets
      const multiPlaceholders = values
        .map(() => `(${placeholders})`)
        .join(", ");
      const flatValues = values.flat();
      const batchInsertSql = `INSERT INTO ${table.name} (${table.columns.join(", ")}) VALUES ${multiPlaceholders}`;
      await conn.execute(batchInsertSql, flatValues);
    }

    await conn.execute("SET FOREIGN_KEY_CHECKS=1");
    return rows.length;
  } finally {
    conn.release();
  }
}

// ============================================================
// Step 4 : Cleanup
// ============================================================

function cleanupTempFdb(): void {
  const { tempFdbPath } = config.firebird;
  if (fs.existsSync(tempFdbPath)) {
    fs.unlinkSync(tempFdbPath);
    log("FDB temporaire supprimé");
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  const startTime = Date.now();
  log("=== Début de la synchronisation ===");

  // MariaDB connection pool
  const pool = mysql.createPool({
    host: config.mariadb.host,
    port: config.mariadb.port,
    user: config.mariadb.user,
    password: config.mariadb.password,
    database: config.mariadb.database,
    waitForConnections: true,
    connectionLimit: 5,
  });

  // Insert sync_meta record (running)
  const [metaResult] = await pool.execute(
    "INSERT INTO _sync_meta (sync_start, status) VALUES (NOW(), 'running')"
  );
  const syncId = (metaResult as mysql.ResultSetHeader).insertId;

  try {
    // Step 1 : Restore GBK
    restoreGbk();

    // Step 2 : Connect to temp FDB
    const fbOptions: Firebird.Options = {
      host: "localhost",
      port: 3050,
      database: config.firebird.tempFdbPath,
      user: config.firebird.user,
      password: config.firebird.password,
      lowercase_keys: false,
      role: undefined,
      pageSize: 4096,
    };

    // Step 3 : Sync each table
    let totalRows = 0;
    let tablesSynced = 0;

    for (const table of TABLES) {
      try {
        const count = await syncTable(fbOptions, pool, table);
        totalRows += count;
        tablesSynced++;
        log(`  ✓ ${table.name} : ${count} lignes`);
      } catch (err) {
        log(`  ✗ ERREUR ${table.name} : ${err}`);
        throw err;
      }
    }

    // Step 4 : Update sync_meta (success)
    const durationMs = Date.now() - startTime;
    await pool.execute(
      "UPDATE _sync_meta SET sync_end = NOW(), status = 'success', tables_synced = ?, rows_synced = ?, duration_ms = ? WHERE id = ?",
      [tablesSynced, totalRows, durationMs, syncId]
    );

    log(
      `=== Synchronisation terminée : ${tablesSynced} tables, ${totalRows} lignes, ${durationMs}ms ===`
    );
  } catch (err) {
    // Update sync_meta (error)
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    await pool.execute(
      "UPDATE _sync_meta SET sync_end = NOW(), status = 'error', error_message = ?, duration_ms = ? WHERE id = ?",
      [errorMsg, durationMs, syncId]
    );
    log(`=== ERREUR de synchronisation : ${errorMsg} ===`);
    throw err;
  } finally {
    // Step 5 : Cleanup
    cleanupTempFdb();
    await pool.end();
  }
}

main().catch((err) => {
  log(`FATAL: ${err}`);
  process.exit(1);
});
