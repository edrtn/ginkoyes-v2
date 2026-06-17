# Projet : Ginkoyes V2

Ce projet est géré par **DashClaude**.


## Base de données projet

Le fichier `.dashclaude-data.json` à la racine contient la base de données du projet (identifiants, clés API, mots de passe, etc.).
- Format : tableau JSON, chaque entrée suit le schéma `{ id, category, key, value, sensitive, createdAt, updatedAt }`
- Tu peux lire et écrire dans ce fichier pour stocker ou retrouver des informations du projet.

## Structure des fichiers .dashclaude/

```
.dashclaude/
├── rapports/          # Rapports de fin de session
│   └── YYYY-MM-DD_rapport.md
├── sessions/          # Journaux détaillés de session
│   └── YYYY-MM-DD_session.md
└── notes/             # Notes techniques libres
    └── *.md
```

### Rapports (`.dashclaude/rapports/YYYY-MM-DD_rapport.md`)
Résumé de fin de session : tâches complétées, problèmes rencontrés, prochaines étapes.

### Sessions (`.dashclaude/sessions/YYYY-MM-DD_session.md`)
Journal détaillé : commandes exécutées, fichiers modifiés, décisions prises.

### Notes (`.dashclaude/notes/*.md`)
Notes techniques libres (architecture, procédures, etc.).

## Architecture technique

### Build Electron
- **Dev** : `npm run electron:dev` → esbuild bundle `electron/main.ts` + `electron/preload.ts`
- **CI/Prod** : le workflow `.github/workflows/build.yml` doit utiliser **esbuild** (pas `tsc`) pour bundler le main process. `tsc` transpile sans bundler → les modules comme `electron-store`, `socks` etc. ne sont pas trouvés au runtime car `node_modules` est exclu du package.
- **Règle** : toujours utiliser `npx esbuild electron/main.ts --bundle --platform=node --outfile=dist-electron/main.js --external:electron --format=cjs` pour compiler le main process (dev ET CI).

### Releases & Auto-update
- **Client** (SportLink) : tag `v*` → déclenche `.github/workflows/build.yml` → builds Windows (.exe) + Mac (.dmg/.zip) → release GitHub → `electron-updater` détecte via `latest.yml` / `latest-mac.yml`
- **Server** (SportLink Server) : tag `server-v*` → déclenche `.github/workflows/build-server.yml` → build Windows uniquement (InnoSetup)
- **Important** : les tags `server-v*` ne doivent PAS déclencher le build client, et vice-versa
- **Pas de Linux** : le build Linux est désactivé (pas de `tailscale-bin/linux`, problème icône ICNS→PNG)
- Le workflow utilise `fail-fast: false` pour que l'échec d'une plateforme ne bloque pas les autres

### Connexion DB (lib/db.ts)
- Pool avec failover : LAN → VPN/tunnel
- `poolType` (`lan`/`vpn`) trace le type de pool actif pour éviter les faux positifs sur `connectionMode`
- `connectionMode` (`local`/`vpn`/`error`/`unknown`) exposé via `/api/connection-mode` avec ping DB (`SELECT 1`)

## Consignes de session

- **Début de session** : lis le dernier fichier dans `.dashclaude/rapports/` pour reprendre le contexte.
- **Fin de session** : crée un rapport (`rapports/YYYY-MM-DD_rapport.md`) et un journal (`sessions/YYYY-MM-DD_session.md`) pour que le contexte soit retrouvé lors de la prochaine session.
