/**
 * Ginkoyes V2 — Service Windows (daemon)
 *
 * Tourne en permanence, déclenche la sync quotidienne via node-schedule.
 * Enregistré comme service Windows via node-windows (voir install-service.ts).
 *
 * Usage : node service.js (lancé par le service Windows)
 */

import * as fs from "fs";
import * as path from "path";
import schedule from "node-schedule";
import { runSync, SyncConfig } from "./sync";

// ============================================================
// Configuration
// ============================================================

const configPath = path.join(__dirname, "sync-config.json");

function loadConfig(): SyncConfig {
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

// ============================================================
// Logging
// ============================================================

function log(cfg: SyncConfig, message: string) {
  const timestamp = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris", hour12: false }).replace(",", "");
  const line = `[${timestamp}] [SERVICE] ${message}`;
  console.log(line);
  try {
    const logDir = path.dirname(cfg.sync.logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(cfg.sync.logPath, line + "\n");
  } catch {
    // Ignore
  }
}

// ============================================================
// Main
// ============================================================

const cfg = loadConfig();
const cronExpr = cfg.sync.schedule || "10 23 * * *"; // Default: 23:10 daily

log(cfg, `Service Ginkoyes démarré`);
log(cfg, `Sync planifiée : ${cronExpr}`);

let syncRunning = false;

const job = schedule.scheduleJob(cronExpr, async () => {
  if (syncRunning) {
    log(cfg, "Sync déjà en cours, ignoré");
    return;
  }

  syncRunning = true;
  log(cfg, "=== Sync planifiée déclenchée ===");

  try {
    // Reload config in case it changed
    const freshCfg = loadConfig();
    const result = await runSync(freshCfg);
    log(cfg, `Sync OK : ${result.tablesSynced} tables, ${result.totalRows} lignes, ${result.durationMs}ms`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(cfg, `Sync ERREUR : ${msg}`);
  } finally {
    syncRunning = false;
  }
});

// Log next invocation
if (job) {
  const next = job.nextInvocation();
  if (next) {
    log(cfg, `Prochaine sync : ${next.toLocaleString("fr-FR", { timeZone: "Europe/Paris", hour12: false })}`);
  }
}

// ============================================================
// Graceful shutdown
// ============================================================

function shutdown(signal: string) {
  log(cfg, `Signal ${signal} reçu, arrêt du service...`);
  if (job) {
    job.cancel();
  }
  schedule.gracefulShutdown().then(() => {
    log(cfg, "Service arrêté proprement");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Keep process alive
log(cfg, "Service en attente...");
