/**
 * Sync Firebird (Docker container) → MariaDB local
 *
 * Prérequis : container Docker fb4 lancé avec la base restaurée sur port 3051
 * Usage : node sync/sync-from-docker.mjs
 */

import Firebird from "node-firebird";
import mysql from "mysql2/promise";

// ============================================================
// Configuration
// ============================================================

const FB_OPTIONS = {
  host: "127.0.0.1",
  port: 3051,
  database: "/firebird/data/ginkoia.fdb",
  user: "SYSDBA",
  password: "masterkey",
  lowercase_keys: false,
  role: undefined,
  pageSize: 16384,
};

const MYSQL_OPTIONS = {
  host: "127.0.0.1",
  port: 3306,
  user: "ginkoyes",
  password: "ginkoyes",
  database: "ginkoyes",
  waitForConnections: true,
  connectionLimit: 5,
  decimalNumbers: true,
};

// ============================================================
// Tables à synchroniser (ordre FK)
// ============================================================

const TABLES = [
  { name: "ARTMARQUE", columns: ["MRK_ID", "MRK_NOM"] },
  { name: "ARTGENRE", columns: ["GRE_ID", "GRE_NOM"] },
  { name: "NKLRAYON", columns: ["RAY_ID", "RAY_NOM"] },
  { name: "ARTCLASSEMENT", columns: ["CLA_ID", "CLA_NOM"] },
  { name: "ARTFOURN", columns: ["FOU_ID", "FOU_NOM"] },
  { name: "PLXTAILLESGF", columns: ["TGF_ID", "TGF_NOM", "TGF_CORRES"] },
  { name: "PLXCOULEUR", columns: ["COU_ID", "COU_NOM", "COU_CODE", "COU_ARTID"] },
  { name: "NKLFAMILLE", columns: ["FAM_ID", "FAM_NOM", "FAM_RAYID"] },
  { name: "NKLSSFAMILLE", columns: ["SSF_ID", "SSF_NOM", "SSF_FAMID"] },
  { name: "ARTARTICLE", columns: ["ART_ID", "ART_NOM", "ART_REFMRK", "ART_CODE", "ART_CODEFOURN", "ART_MRKID", "ART_GREID", "ART_SSFID"] },
  { name: "ARTCOLLECTION", columns: ["COL_ID", "COL_NOM"] },
  { name: "CSHTICKET", columns: ["TKE_ID", "TKE_DATE", "TKE_NUMERO", "TKE_TOTALTTC"] },
  { name: "NEGBL", columns: ["BLE_ID", "BLE_DATE", "BLE_NUMERO", "BLE_WEB"] },
  { name: "ARTREFERENCE", columns: ["ARF_ID", "ARF_ARTID", "ARF_CHRONO", "ARF_ICLID1"] },
  { name: "ARTCOLART", columns: ["CAR_ARTID", "CAR_COLID"], skipPk: true },
  { name: "AGRSTOCKCOUR", columns: ["STC_ARTID", "STC_TGFID", "STC_COUID", "STC_QTE", "STC_PUMP"] },
  { name: "COMBCDE", columns: ["CDE_ID", "CDE_COLID", "CDE_FOUID", "CDE_DATE"] },
  { name: "RECBR", columns: ["BRE_ID", "BRE_DATE", "BRE_NUMERO", "BRE_NUMFOURN", "BRE_FOUID", "BRE_COLID"] },
  { name: "ARTCLAITEM", columns: ["CIT_ICLID", "CIT_CLAID"], skipPk: true },
  { name: "ARTCODEBARRE", columns: ["CBI_ID", "CBI_CB", "CBI_ARFID"] },
  { name: "CSHTICKETL", columns: ["TKL_ID", "TKL_TKEID", "TKL_ARTID", "TKL_NOM", "TKL_QTE", "TKL_PXBRUT", "TKL_REMISE", "TKL_PXNET", "TKL_PXNNHT", "TKL_TGFID", "TKL_COUID"] },
  { name: "NEGBLL", columns: ["BLL_ID", "BLL_BLEID", "BLL_ARTID", "BLL_QTE", "BLL_PXBRUT", "BLL_PXNET", "BLL_PXNN", "BLL_TGFID", "BLL_COUID"] },
  { name: "COMBCDEL", columns: ["CDL_ID", "CDL_CDEID", "CDL_ARTID", "CDL_COUID", "CDL_TGFID", "CDL_QTE", "CDL_PXACHAT", "CDL_PXVENTE", "CDL_REMISE1", "CDL_REMISE2", "CDL_REMISE3"] },
  { name: "RECBRL", columns: ["BRL_ID", "BRL_BREID", "BRL_ARTID", "BRL_QTE", "BRL_PXACHAT", "BRL_PXVENTE", "BRL_TGFID", "BRL_COUID"] },
];

// ============================================================
// Firebird query helper — streams rows to avoid loading everything in RAM
// ============================================================

function queryFirebird(sql, retries = 3) {
  return new Promise((resolve, reject) => {
    function attempt(n) {
      Firebird.attach(FB_OPTIONS, (err, db) => {
        if (err) {
          if (n > 1) {
            setTimeout(() => attempt(n - 1), 2000);
            return;
          }
          return reject(err);
        }
        db.query(sql, [], (err, result) => {
          db.detach();
          if (err) {
            if (n > 1) {
              setTimeout(() => attempt(n - 1), 2000);
              return;
            }
            return reject(err);
          }
          resolve(result || []);
        });
      });
    }
    attempt(retries);
  });
}

// ============================================================
// Sync one table
// ============================================================

async function syncTable(pool, table) {
  const selectSql = `SELECT ${table.columns.join(", ")} FROM ${table.name}`;

  process.stdout.write(`  ${table.name} — lecture Firebird...`);
  const rows = await queryFirebird(selectSql);
  process.stdout.write(` ${rows.length} lignes`);

  if (rows.length === 0) {
    const conn = await pool.getConnection();
    await conn.execute("SET FOREIGN_KEY_CHECKS=0");
    await conn.execute(`TRUNCATE TABLE ${table.name}`);
    await conn.execute("SET FOREIGN_KEY_CHECKS=1");
    conn.release();
    console.log(" → 0 insérées");
    return 0;
  }

  const conn = await pool.getConnection();
  try {
    await conn.execute("SET FOREIGN_KEY_CHECKS=0");
    await conn.execute(`TRUNCATE TABLE ${table.name}`);

    const batchSize = 500;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values = batch.map((row) =>
        table.columns.map((col) => {
          const val = row[col];
          if (val instanceof Date) {
            return val.toISOString().slice(0, 10);
          }
          // Convert Buffer to string (Firebird BLOB/VARCHAR)
          if (Buffer.isBuffer(val)) {
            return val.toString("utf-8");
          }
          return val ?? null;
        })
      );

      const placeholders = table.columns.map(() => "?").join(", ");
      const multiPlaceholders = values.map(() => `(${placeholders})`).join(", ");
      const flatValues = values.flat();

      await conn.execute(
        `INSERT INTO ${table.name} (${table.columns.join(", ")}) VALUES ${multiPlaceholders}`,
        flatValues
      );
      inserted += batch.length;

      if (i % 5000 === 0 && i > 0) {
        process.stdout.write(` [${inserted}]`);
      }
    }

    await conn.execute("SET FOREIGN_KEY_CHECKS=1");
    console.log(` → ${inserted} insérées ✓`);
    return inserted;
  } finally {
    conn.release();
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log("=== Sync Firebird (Docker) → MariaDB ===\n");
  const startTime = Date.now();

  const pool = mysql.createPool(MYSQL_OPTIONS);

  // Test MariaDB connection
  const [testRows] = await pool.execute("SELECT 1");
  console.log("MariaDB : connecté ✓");

  // Test Firebird connection
  const fbTest = await queryFirebird("SELECT COUNT(*) AS CNT FROM ARTARTICLE");
  console.log(`Firebird : connecté ✓ (${fbTest[0].CNT} articles)\n`);

  let totalRows = 0;
  let tablesSynced = 0;

  for (const table of TABLES) {
    try {
      const count = await syncTable(pool, table);
      totalRows += count;
      tablesSynced++;
    } catch (err) {
      console.error(`\n  ✗ ERREUR ${table.name} : ${err.message}`);
      // Continue with next table instead of failing completely
      console.log("  → Table ignorée, on continue...");
    }
  }

  // Refresh _ventes_daily summary table
  console.log("\nRafraîchissement de _ventes_daily...");
  await pool.execute("CALL refresh_ventes_daily()");
  console.log("_ventes_daily rafraîchi ✓");

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Terminé : ${tablesSynced} tables, ${totalRows.toLocaleString()} lignes, ${durationSec}s ===`);

  await pool.end();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
