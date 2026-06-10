# Procédure de mise à jour de la base Firebird

## Contexte

L'application Ginkoyes V2 se connecte **directement** à la base Firebird dans Docker (localhost:3050). Pas de base intermédiaire MySQL/MariaDB. Quand le client fournit un nouveau fichier de sauvegarde `SV.GBK`, il suffit de le restaurer dans le container — rien à reconstruire côté application.

## Prérequis

- Container Docker `ginkoia-firebird` actif (`docker ps`)
- Nouveau fichier de sauvegarde `SV.GBK` fourni par le client
- Le client extrait le `SV.GBK` depuis son logiciel Ginkoia (sauvegarde automatique quotidienne)

## Procédure complète

### 1. Copier le fichier SV.GBK dans le dossier monté

Le client dépose le fichier quelque part sur le Mac (ex: un dossier `sauvegarde_JJ:MM:AAAA/`). Le copier dans le dossier monté par Docker :

```bash
cp /chemin/vers/nouveau/SV.GBK /Users/edwardrenton/Projects/ginkoyes-v2/Ginkoia/Data/Backup/Save1/SV.GBK
```

Ce dossier est monté dans le container Docker sur `/backup`.

### 2. Arrêter le serveur Next.js

Stopper le process `npm run dev` (ou Ctrl+C) pour libérer les connexions Firebird.

### 3. Restaurer le backup dans un nouveau fichier

```bash
docker exec ginkoia-firebird /usr/local/firebird/bin/gbak -c \
  -user SYSDBA -password ginkoia \
  -FIX_FSS_METADATA WIN1252 -FIX_FSS_DATA WIN1252 \
  /backup/SV.GBK /firebird/data/ginkoia_new.fdb
```

**Notes :**
- `-c` = create (nouveau fichier, ne touche pas à la base active)
- `-FIX_FSS_METADATA WIN1252 -FIX_FSS_DATA WIN1252` = **obligatoire** pour l'encodage français de Ginkoia
- Les centaines de warnings `do not recognize table attribute 18` sont **normaux** (le backup vient d'une version Firebird plus récente que 4.0) — les ignorer
- Durée : ~2-3 minutes pour un fichier de 1.8 Go
- Si erreur `already exists`, supprimer d'abord : `docker exec ginkoia-firebird rm -f /firebird/data/ginkoia_new.fdb`

### 4. Vérifier que la restauration a fonctionné

```bash
docker exec ginkoia-firebird bash -c \
  "echo \"SELECT COUNT(*) FROM CSHTICKET;\" | /usr/local/firebird/bin/isql -user SYSDBA -password ginkoia /firebird/data/ginkoia_new.fdb"
```

Doit retourner ~630 000+ tickets. Si erreur, la restauration a échoué.

### 5. Remplacer l'ancienne base

```bash
docker exec ginkoia-firebird bash -c \
  "mv /firebird/data/ginkoia.fdb /firebird/data/ginkoia_old.fdb && \
   mv /firebird/data/ginkoia_new.fdb /firebird/data/ginkoia.fdb"
```

### 6. Redémarrer le container et remettre la base en ligne

```bash
docker stop ginkoia-firebird
sleep 2
docker start ginkoia-firebird
sleep 5
docker exec ginkoia-firebird /usr/local/firebird/bin/gfix -online -user SYSDBA -password ginkoia /firebird/data/ginkoia.fdb
```

**CRITIQUE** : l'étape `gfix -online` est **indispensable**. `gbak -c` restaure la base en mode "shutdown". Sans cette commande, toutes les connexions seront refusées avec l'erreur `Database shutdown`.

### 7. Vérifier que la base est accessible

```bash
docker exec ginkoia-firebird bash -c \
  "echo \"SELECT FIRST 1 TKE_DATE FROM CSHTICKET ORDER BY TKE_DATE DESC;\" | /usr/local/firebird/bin/isql -user SYSDBA -password ginkoia /firebird/data/ginkoia.fdb"
```

La date retournée doit correspondre au dernier jour de vente avant la sauvegarde.

### 8. Relancer le serveur Next.js

```bash
rm -rf .next
npm run dev -- -p 3001
```

Le `rm -rf .next` nettoie le cache Turbopack (évite les erreurs de persistence).

### 9. (Optionnel) Supprimer l'ancienne base

Une fois que tout est validé sur l'app :

```bash
docker exec ginkoia-firebird rm /firebird/data/ginkoia_old.fdb
```

## Résumé rapide (copier-coller)

```bash
# 1. Copier le nouveau SV.GBK
cp /chemin/vers/SV.GBK /Users/edwardrenton/Projects/ginkoyes-v2/Ginkoia/Data/Backup/Save1/SV.GBK

# 2. Stopper Next.js (Ctrl+C ou kill le process)

# 3. Restaurer
docker exec ginkoia-firebird rm -f /firebird/data/ginkoia_new.fdb
docker exec ginkoia-firebird /usr/local/firebird/bin/gbak -c -user SYSDBA -password ginkoia -FIX_FSS_METADATA WIN1252 -FIX_FSS_DATA WIN1252 /backup/SV.GBK /firebird/data/ginkoia_new.fdb

# 4. Swapper les fichiers
docker exec ginkoia-firebird bash -c "mv /firebird/data/ginkoia.fdb /firebird/data/ginkoia_old.fdb && mv /firebird/data/ginkoia_new.fdb /firebird/data/ginkoia.fdb"

# 5. Restart + online
docker stop ginkoia-firebird && sleep 2 && docker start ginkoia-firebird && sleep 5
docker exec ginkoia-firebird /usr/local/firebird/bin/gfix -online -user SYSDBA -password ginkoia /firebird/data/ginkoia.fdb

# 6. Relancer l'app
rm -rf .next && npm run dev -- -p 3001

# 7. (Quand tout est OK) Nettoyer
docker exec ginkoia-firebird rm /firebird/data/ginkoia_old.fdb
```

## Infos techniques

- **Container** : `ginkoia-firebird` (image `jacobalberty/firebird:v4.0`)
- **Base** : `/firebird/data/ginkoia.fdb` (dans un volume Docker)
- **Mount backup** : `Ginkoia/Data/Backup/Save1/` → `/backup` dans le container
- **Credentials** : `SYSDBA` / `ginkoia`
- **Port** : localhost:3050
- **L'app se connecte directement à Firebird**, pas de base intermédiaire

## Erreurs fréquentes

| Erreur | Cause | Solution |
|--------|-------|----------|
| `Database shutdown` | `gfix -online` oublié après restauration | `docker stop/start` puis `gfix -online` |
| `could not drop database (in use)` | Connexions actives (Next.js tourne) | Stopper Next.js d'abord |
| `Invalid metadata. Use -FIX_FSS_METADATA` | Encodage français | Ajouter `-FIX_FSS_METADATA WIN1252 -FIX_FSS_DATA WIN1252` |
| `do not recognize table attribute 18` | Version Firebird du backup > 4.0 | Warning normal, ignorer |
| `already exists` | Fichier `ginkoia_new.fdb` d'une tentative précédente | `rm -f /firebird/data/ginkoia_new.fdb` |
| `user name and password not defined` | Pool de connexions corrompu | Redémarrer Next.js |
