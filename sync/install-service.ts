/**
 * Ginkoyes V2 — Enregistrement / désenregistrement du service Windows
 *
 * Usage :
 *   node install-service.js              → installe et démarre le service
 *   node install-service.js uninstall    → arrête et supprime le service
 */

import * as path from "path";
// @ts-expect-error — node-windows n'a pas de types
import { Service } from "node-windows";

const servicePath = path.join(__dirname, "service.js");

const svc = new Service({
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
  svc.on("error", (err: Error) => {
    console.error("Erreur lors de la désinstallation :", err.message);
  });
  svc.uninstall();
} else {
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
  svc.on("error", (err: Error) => {
    console.error("Erreur lors de l'installation :", err.message);
  });
  svc.install();
}
