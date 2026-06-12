"use strict";
/**
 * Ginkoyes V2 — Enregistrement / désenregistrement du service Windows
 *
 * Usage :
 *   node install-service.js              → installe et démarre le service
 *   node install-service.js uninstall    → arrête et supprime le service
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
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
// @ts-expect-error — node-windows n'a pas de types
const node_windows_1 = require("node-windows");
const servicePath = path.join(__dirname, "service.js");
const svc = new node_windows_1.Service({
    name: "GinkoyesSync",
    description: "Ginkoyes V2 - Synchronisation nightly Ginkoia vers MariaDB",
    script: servicePath,
    nodeOptions: ["--max-old-space-size=4096"],
    // Restart on failure
    wait: 2,
    grow: 0.5,
    maxRestarts: 10,
});
const action = process.argv[2];
if (action === "uninstall") {
    svc.on("uninstall", () => {
        console.log("Service GinkoyesSync désinstallé.");
    });
    svc.on("error", (err) => {
        console.error("Erreur lors de la désinstallation :", err.message);
    });
    svc.uninstall();
}
else {
    svc.on("install", () => {
        console.log("Service GinkoyesSync installé. Démarrage...");
        svc.start();
    });
    svc.on("start", () => {
        console.log("Service GinkoyesSync démarré.");
    });
    svc.on("alreadyinstalled", () => {
        console.log("Service GinkoyesSync déjà installé. Redémarrage...");
        svc.start();
    });
    svc.on("error", (err) => {
        console.error("Erreur lors de l'installation :", err.message);
    });
    svc.install();
}
