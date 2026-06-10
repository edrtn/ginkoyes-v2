# Schéma des liaisons principales - Base Ginkoia

## Connexion Firebird (Docker)

- **Host** : localhost
- **Port** : 3050
- **Database** : /firebird/data/ginkoia.fdb
- **User** : SYSDBA
- **Password** : ginkoia
- **Container** : ginkoia-firebird (image jacobalberty/firebird:v4.0)

## Article complet

```
ARTARTICLE (ART_ID)
├── ARTREFERENCE (ARF_ARTID → ART_ID)
│   ├── ARF_CHRONO = référence interne Ginkoia (ex: "2-17112")
│   ├── ARF_ICLID1 → ARTCLAITEM.CIT_ICLID (classement 1)
│   └── ARTCODEBARRE (CBI_ARFID → ARF_ID)
│       └── CBI_CB = code-barres EAN
├── ARTCOLART (CAR_ARTID → ART_ID)
│   └── ARTCOLLECTION (COL_ID = CAR_COLID)
│       └── COL_NOM = saison (ex: "PRINTEMPS ETE 2025")
├── ARTMARQUE (MRK_ID = ART_MRKID)
│   └── MRK_NOM = nom marque (ex: "NIKE")
├── ARTGENRE (GRE_ID = ART_GREID)
│   └── GRE_NOM = genre (ex: "HOMME")
├── NKLSSFAMILLE (SSF_ID = ART_SSFID) — sous-famille
│   └── NKLFAMILLE (FAM_ID = SSF_FAMID) — famille
│       └── NKLRAYON (RAY_ID = FAM_RAYID) — rayon
└── Champs directs :
    ├── ART_NOM = nom article
    ├── ART_REFMRK = référence marque (ex: "HQ6034 800")
    ├── ART_CODE = code article
    ├── ART_CODEFOURN = code fournisseur
    └── ART_SESSION, ART_THEME, ART_GAMME = (souvent vides)
```

## Classement article

```
ARTREFERENCE.ARF_ICLID1 → ARTCLAITEM.CIT_ICLID
ARTCLAITEM.CIT_CLAID → ARTCLASSEMENT.CLA_ID
    └── CLA_NOM = nom du classement (ex: "Rangement shoes")
    └── CLA_TYPE = type (ART, CLT, PRO, LOC, LOT, DPV)
    └── CLA_NUM = numéro de classement (1 à 6)
```

## Stock courant

```
AGRSTOCKCOUR (STC_ARTID → ART_ID)
├── STC_MAGID = magasin
├── STC_TGFID → PLXTAILLESGF.TGF_ID
│   └── TGF_NOM = taille (ex: "42", "43")
├── STC_COUID → PLXCOULEUR.COU_ID
│   └── COU_NOM = couleur (ex: "APRICOT-800")
├── STC_QTE = quantité en stock
└── STC_PUMP = prix unitaire moyen pondéré (prix d'achat)
```

## Historique stock

```
AGRHISTOSTOCK — 1 764 868 mouvements
```

## Clients & Fidélité

```
CLTCLIENT (CLT_ID)
├── CLTFIDELITE — cartes fidélité
└── CLTBONACHAT — bons d'achat
```

## Ventes / Caisse

```
CSHSESSION (SES_ID)
└── CSHTICKET (TKE_ID, TKE_SESID → SES_ID)
    ├── TKE_DATE = date du ticket
    ├── TKE_NUMERO = numéro ticket
    ├── TKE_CLTID → CLTCLIENT.CLT_ID (client)
    ├── TKE_TOTALTTC = total TTC
    ├── CSHTICKETL (TKL_ID, TKL_TKEID → TKE_ID)
    │   ├── TKL_ARTID → ARTARTICLE.ART_ID
    │   ├── TKL_TGFID → PLXTAILLESGF.TGF_ID (taille)
    │   ├── TKL_COUID → PLXCOULEUR.COU_ID (couleur)
    │   ├── TKL_NOM = nom article sur ticket
    │   ├── TKL_QTE = quantité
    │   ├── TKL_PXBRUT = prix brut
    │   ├── TKL_REMISE = % remise
    │   ├── TKL_PXNET = prix net TTC
    │   └── TKL_PXNNHT = prix net HT
    └── CSHENCAISSEMENT (encaissements/règlements)
```

## Négoce (BL / Factures / Devis)

```
NEGFACTURE → NEGFACTUREL (lignes)
NEGBL → NEGBLL (lignes)
NEGDEVIS → NEGDEVISL (lignes)
```

## Achats / Commandes / Réceptions

```
COMBCDE (CDE_ID) — commandes fournisseurs
├── CDE_NUMERO = numéro commande
└── COMBCDEL (CDL_ID, CDL_CDEID → CDE_ID) — lignes

COMRETOUR (RET_ID) — retours fournisseurs
└── COMRETOURL — lignes

RECBR (BRE_ID) — bons de réception
├── BRE_NUMERO = numéro BR (ex: "1-45045")
├── BRE_DATE = date réception
├── BRE_FOUID → ARTFOURN.FOU_ID (fournisseur)
├── BRE_NUMFOURN = numéro BL fournisseur (ex: "BL227848")
├── BRE_SAISON = saison (souvent 0)
├── BRE_COLID → ARTCOLLECTION.COL_ID (collection)
├── BRE_MAGID = magasin
└── RECBRL (BRL_ID, BRL_BREID → BRE_ID) — lignes
    ├── BRL_ARTID → ARTARTICLE.ART_ID
    ├── BRL_TGFID → PLXTAILLESGF.TGF_ID (taille)
    ├── BRL_COUID → PLXCOULEUR.COU_ID (couleur)
    ├── BRL_QTE = quantité reçue
    ├── BRL_PXACHAT = prix d'achat
    ├── BRL_PXVENTE = prix de vente
    ├── BRL_REMISE1, BRL_REMISE2, BRL_REMISE3 = remises
    └── BRL_CDENUMERO = numéro commande liée
```

## Fournisseurs

```
ARTFOURN (FOU_ID)
├── FOU_NOM = nom fournisseur
├── FOU_CODE = code
└── ARTFOURNCOL (AFC_FOUID → FOU_ID, AFC_COLID → COL_ID)
    └── liaison fournisseur <-> collection
```

## Nomenclature (rayons/familles)

```
NKLRAYON (RAY_ID)
└── NKLFAMILLE (FAM_RAYID → RAY_ID)
    └── NKLSSFAMILLE (SSF_FAMID → FAM_ID)
```

## Tailles / Couleurs

```
PLXTAILLESGF — tailles (TGF_ID, TGF_NOM)
PLXCOULEUR — couleurs (COU_ID, COU_NOM)
PLXMARKCOU — liaison marque <-> couleur
```

## SAV

```
SAVFICHEE — fiches SAV (4 829 fiches)
```

## Magasins

```
GENMAGASIN — 2 magasins
```

## Exemple de requête complète (article + marque + rayon + saison + stock)

```sql
SELECT a.ART_ID, a.ART_NOM, a.ART_REFMRK,
       r.ARF_CHRONO,
       mrk.MRK_NOM AS MARQUE,
       ray.RAY_NOM AS RAYON,
       fam.FAM_NOM AS FAMILLE,
       ssf.SSF_NOM AS SOUS_FAMILLE,
       gen.GRE_NOM AS GENRE,
       col.COL_NOM AS SAISON,
       s.STC_QTE AS STOCK,
       t.TGF_NOM AS TAILLE,
       cou.COU_NOM AS COULEUR,
       s.STC_PUMP AS PRIX_ACHAT
FROM ARTARTICLE a
JOIN ARTREFERENCE r ON r.ARF_ARTID = a.ART_ID
LEFT JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
LEFT JOIN ARTGENRE gen ON gen.GRE_ID = a.ART_GREID
LEFT JOIN NKLSSFAMILLE ssf ON ssf.SSF_ID = a.ART_SSFID
LEFT JOIN NKLFAMILLE fam ON fam.FAM_ID = ssf.SSF_FAMID
LEFT JOIN NKLRAYON ray ON ray.RAY_ID = fam.FAM_RAYID
LEFT JOIN ARTCOLART ca ON ca.CAR_ARTID = a.ART_ID
LEFT JOIN ARTCOLLECTION col ON col.COL_ID = ca.CAR_COLID
LEFT JOIN AGRSTOCKCOUR s ON s.STC_ARTID = a.ART_ID
LEFT JOIN PLXTAILLESGF t ON t.TGF_ID = s.STC_TGFID
LEFT JOIN PLXCOULEUR cou ON cou.COU_ID = s.STC_COUID
WHERE a.ART_ID = 53589536;
```

## Requête historique ventes d'un article

```sql
SELECT t.TKE_DATE, t.TKE_NUMERO,
       l.TKL_NOM, l.TKL_QTE, l.TKL_PXBRUT, l.TKL_REMISE, l.TKL_PXNET,
       tg.TGF_NOM AS TAILLE, cou.COU_NOM AS COULEUR
FROM CSHTICKETL l
JOIN CSHTICKET t ON t.TKE_ID = l.TKL_TKEID
LEFT JOIN PLXTAILLESGF tg ON tg.TGF_ID = l.TKL_TGFID
LEFT JOIN PLXCOULEUR cou ON cou.COU_ID = l.TKL_COUID
WHERE l.TKL_ARTID = :ART_ID
ORDER BY t.TKE_DATE;
```

## Requête historique réceptions d'un article

```sql
SELECT br.BRE_DATE, br.BRE_NUMERO, br.BRE_NUMFOURN,
       f.FOU_NOM,
       l.BRL_QTE, l.BRL_PXACHAT, l.BRL_PXVENTE,
       tg.TGF_NOM AS TAILLE, cou.COU_NOM AS COULEUR
FROM RECBRL l
JOIN RECBR br ON br.BRE_ID = l.BRL_BREID
LEFT JOIN ARTFOURN f ON f.FOU_ID = br.BRE_FOUID
LEFT JOIN PLXTAILLESGF tg ON tg.TGF_ID = l.BRL_TGFID
LEFT JOIN PLXCOULEUR cou ON cou.COU_ID = l.BRL_COUID
WHERE l.BRL_ARTID = :ART_ID
ORDER BY br.BRE_DATE, tg.TGF_NOM;
```

## Requête fiche article complète (toutes infos)

```sql
SELECT a.ART_ID, a.ART_NOM, a.ART_REFMRK,
       r.ARF_CHRONO AS REF_GINKOIA,
       mrk.MRK_NOM AS MARQUE,
       ray.RAY_NOM AS RAYON,
       fam.FAM_NOM AS FAMILLE,
       ssf.SSF_NOM AS SOUS_FAMILLE,
       gen.GRE_NOM AS GENRE,
       col.COL_NOM AS SAISON,
       ci.CIT_ID, cla.CLA_NOM AS CLASSEMENT,
       s.STC_QTE AS STOCK,
       t.TGF_NOM AS TAILLE,
       cou.COU_NOM AS COULEUR,
       s.STC_PUMP AS PRIX_ACHAT
FROM ARTARTICLE a
JOIN ARTREFERENCE r ON r.ARF_ARTID = a.ART_ID
LEFT JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
LEFT JOIN ARTGENRE gen ON gen.GRE_ID = a.ART_GREID
LEFT JOIN NKLSSFAMILLE ssf ON ssf.SSF_ID = a.ART_SSFID
LEFT JOIN NKLFAMILLE fam ON fam.FAM_ID = ssf.SSF_FAMID
LEFT JOIN NKLRAYON ray ON ray.RAY_ID = fam.FAM_RAYID
LEFT JOIN ARTCOLART ca ON ca.CAR_ARTID = a.ART_ID
LEFT JOIN ARTCOLLECTION col ON col.COL_ID = ca.CAR_COLID
LEFT JOIN ARTCLAITEM ci ON ci.CIT_ICLID = r.ARF_ICLID1
LEFT JOIN ARTCLASSEMENT cla ON cla.CLA_ID = ci.CIT_CLAID
LEFT JOIN AGRSTOCKCOUR s ON s.STC_ARTID = a.ART_ID
LEFT JOIN PLXTAILLESGF t ON t.TGF_ID = s.STC_TGFID
LEFT JOIN PLXCOULEUR cou ON cou.COU_ID = s.STC_COUID
WHERE a.ART_ID = :ART_ID;
```
