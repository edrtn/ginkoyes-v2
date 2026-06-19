"use strict";
/**
 * SportLink Server — Service Windows (daemon)
 *
 * Tourne en permanence, déclenche la sync quotidienne via node-schedule.
 * Enregistré comme service Windows via node-windows (voir install-service.ts).
 *
 * Usage : node service.js (lancé par le service Windows)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const node_schedule_1 = __importDefault(require("node-schedule"));
const sync_1 = require("./sync");
// ============================================================
// Configuration
// ============================================================
const configPath = path.join(__dirname, "sync-config.json");
function loadConfig() {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}
// ============================================================
// Logging
// ============================================================
function log(cfg, message) {
    const timestamp = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris", hour12: false }).replace(",", "");
    const line = `[${timestamp}] [SERVICE] ${message}`;
    console.log(line);
    try {
        const logDir = path.dirname(cfg.sync.logPath);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        fs.appendFileSync(cfg.sync.logPath, line + "\n");
    }
    catch {
        // Ignore
    }
}
// ============================================================
// Main
// ============================================================
const cfg = loadConfig();
const cronExpr = cfg.sync.schedule || "0 2 * * *"; // Default: 02:00 daily
log(cfg, `Service SportLink démarré`);
log(cfg, `Sync planifiée : ${cronExpr}`);
let syncRunning = false;
const job = node_schedule_1.default.scheduleJob(cronExpr, async () => {
    if (syncRunning) {
        log(cfg, "Sync déjà en cours, ignoré");
        return;
    }
    syncRunning = true;
    log(cfg, "=== Sync planifiée déclenchée ===");
    try {
        // Reload config in case it changed
        const freshCfg = loadConfig();
        const result = await (0, sync_1.runSync)(freshCfg);
        log(cfg, `Sync OK : ${result.tablesSynced} tables, ${result.totalRows} lignes, ${result.durationMs}ms`);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(cfg, `Sync ERREUR : ${msg}`);
    }
    finally {
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
function shutdown(signal) {
    log(cfg, `Signal ${signal} reçu, arrêt du service...`);
    if (job) {
        job.cancel();
    }
    node_schedule_1.default.gracefulShutdown().then(() => {
        log(cfg, "Service arrêté proprement");
        process.exit(0);
    });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
// Keep process alive
log(cfg, "Service en attente...");
