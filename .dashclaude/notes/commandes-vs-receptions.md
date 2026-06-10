# Commandes vs Réceptions Ginkoia

## Commandes fournisseurs — `COMBCDE` / `COMBCDEL`

### Table en-tête : `COMBCDE`
- `CDE_ID` — identifiant
- `CDE_NUMERO` — numéro commande (ex: "2-1533")
- `CDE_DATE` — date de la commande
- `CDE_FOUID` → `ARTFOURN.FOU_ID` — fournisseur
- `CDE_COLID` → `ARTCOLLECTION.COL_ID` — collection/saison
- `CDE_MAGID` — magasin
- `CDE_SAISON` — code saison (souvent 0)

### Table lignes : `COMBCDEL`
- `CDL_ID` — identifiant ligne
- `CDL_CDEID` → `CDE_ID` — lien commande
- `CDL_ARTID` → `ARTARTICLE.ART_ID` — article
- `CDL_TGFID` → `PLXTAILLESGF.TGF_ID` — taille
- `CDL_COUID` → `PLXCOULEUR.COU_ID` — couleur
- `CDL_QTE` — quantité commandée
- `CDL_PXACHAT` — prix d'achat unitaire
- `CDL_PXVENTE` — prix de vente prévu
- `CDL_REMISE1`, `CDL_REMISE2`, `CDL_REMISE3` — % remises
- `CDL_COLID` — collection (aussi au niveau ligne)

### Usage
- Base pour l'analyse achat (combien on a commandé)
- Le "Récap commande" et "Détail par article" se basent sur `COMBCDEL`

## Réceptions — `RECBR` / `RECBRL`

### Table en-tête : `RECBR`
- `BRE_ID` — identifiant
- `BRE_NUMERO` — numéro BR (ex: "1-45045")
- `BRE_DATE` — date de réception
- `BRE_FOUID` → `ARTFOURN.FOU_ID` — fournisseur
- `BRE_NUMFOURN` — numéro BL fournisseur (ex: "BL227848")
- `BRE_COLID` → `ARTCOLLECTION.COL_ID` — collection
- `BRE_MAGID` — magasin

### Table lignes : `RECBRL`
- `BRL_ID`, `BRL_BREID` → `BRE_ID`
- `BRL_ARTID`, `BRL_TGFID`, `BRL_COUID` — article/taille/couleur
- `BRL_QTE` — quantité reçue
- `BRL_PXACHAT`, `BRL_PXVENTE` — prix
- `BRL_REMISE1/2/3` — remises
- `BRL_CDENUMERO` — numéro commande liée

### Usage
- Suivi livraison : combien on a reçu vs commandé
- Colonne "Reçu" dans le taux de sortie
- **NE PAS utiliser comme base pour le "commandé"** (articles non livrés = absents)

## Exemple HOKA PE 2026
- **Commandes** : 10 modèles, 101 paires (2 commandes : 2-1533 + 2-1648)
- **Réceptions** : 8 modèles, 63 paires (BONDI 9 et CLIFTON 10 FEMME pas encore reçus)
- Le CHALLENGER 8 HOMME : 13 commandés mais seulement 3 reçus
