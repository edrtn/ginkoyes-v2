# Structure Générale du Projet Ginkoyes V2

## Composants

### 1. SportLink (Dashboard)
- **Description** : Dashboard principal de gestion pour Pradal Sports. Se connecte à la base Firebird Ginkoia pour afficher articles, ventes, réceptions, pilotage marques, doublons, etc.
- **Technos** : Next.js 16 + Electron
- **Plateformes** : macOS, Windows (pas de Linux)
- **Build** : CI GitHub Actions → .exe (Windows) + .dmg/.zip (Mac), auto-update via electron-updater
- **Emplacement** : `app/`, `components/`, `lib/`, `electron/`, `sql/`, `build/`

### 2. SportLink Serveur
- **Description** : Application serveur Windows installée sur la machine du magasin. Gère la synchronisation de la base Firebird et la configuration du tunnel SSH.
- **Technos** : Electron, InnoSetup, PowerShell, service Windows / tâches planifiées
- **Build** : CI GitHub Actions, déclenché par tags `server-v*`
- **Emplacement** : `server-app/`
- **UI** : Carte Service, Carte Tunnel SSH (config VPS persistée en DB), historique sync, journal

### 3. SportLink.tech
- **Description** : Site de présentation / landing page du produit SportLink.
- **Hébergement** : VPS IONOS (85.215.176.58), certificat SSL Let's Encrypt
- **URL** : https://sportlink.tech
- **Emplacement** : `site/`

### 4. SportLink Demo
- **Description** : Instance de démonstration du dashboard avec une fausse base de données, pour montrer le produit aux clients potentiels.
- **Hébergement** : Sur sportlink.tech (serveur en ligne)

## Architecture réseau

### Connexion LAN (réseau local)
Le dashboard client se connecte directement à MariaDB sur le serveur du magasin (port 3306).
- Scan réseau automatique au premier lancement (`ConnectionSetup`)
- Pool avec failover LAN → VPN/tunnel (`lib/db.ts`)

### Tunnel SSH (accès distant via VPS relais)
Pour accéder à la base depuis l'extérieur, un tunnel SSH passe par le VPS IONOS :
```
Client → SSH → VPS (85.215.176.58) → port distant (3307) → MariaDB magasin
```
- **Config côté serveur** : saisie dans SportLink Serveur (carte Tunnel SSH), persistée en table `_vpn_config` (colonnes : `vps_host`, `vps_port`, `ssh_user`, `private_key`, `remote_port`)
- **Config côté client** : stockée dans electron-store, gérée dans la page Settings
- **Aspiration automatique** : lors du setup initial (`ConnectionSetup`), si le client est connecté en LAN, il tire la config SSH depuis la DB serveur via `GET /api/tunnel-config` et la sauvegarde dans electron-store
- **Aspiration manuelle** : bouton "Recuperer du serveur" dans Settings (visible uniquement en mode LAN)
- **IPC serveur** : `get-tunnel-config` / `set-tunnel-config` (main.ts ↔ preload.ts ↔ renderer.js)

### Table `_vpn_config` (MariaDB)
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | INT | Toujours 1 (config unique) |
| `vps_host` | VARCHAR(255) | IP ou hostname du VPS |
| `vps_port` | INT | Port SSH (défaut 22) |
| `ssh_user` | VARCHAR(100) | Utilisateur SSH (défaut "tunnel") |
| `private_key` | TEXT | Clé privée Ed25519 |
| `remote_port` | INT | Port distant sur le VPS (défaut 3307) |

Migrations : `008_vpn_config.sql` → `010_vpn_config_l2tp.sql` → `018_vpn_ssh_tunnel.sql`
