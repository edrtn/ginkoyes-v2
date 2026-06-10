# Ventes Ginkoia : Caisse vs BL (Internet)

## Les 2 sources de ventes

### 1. Caisse magasin — `CSHTICKETL` / `CSHTICKET`
- Ventes réalisées en magasin physique via la caisse
- `CSHTICKET.TKE_DATE` = date du ticket
- `CSHTICKETL.TKL_QTE` = quantité vendue

### 2. Ventes internet (BL) — `NEGBLL` / `NEGBL`
- Ventes réalisées sur le site e-commerce
- Enregistrées comme des **Bons de Livraison** dans le module négoce
- `NEGBL.BLE_DATE` = date du BL
- `NEGBLL.BLL_QTE` = quantité vendue

## Pattern SQL pour compter TOUTES les ventes

```sql
-- Sous-requête unifiée caisse + internet
SELECT ARTID, TGFID, COUID, QTE, PXNET, PXNNHT FROM (
  SELECT TKL_ARTID AS ARTID, TKL_TGFID AS TGFID, TKL_COUID AS COUID,
    TKL_QTE AS QTE, TKL_PXNET AS PXNET, TKL_PXNNHT AS PXNNHT
  FROM CSHTICKETL l
  JOIN CSHTICKET t ON t.TKE_ID = l.TKL_TKEID
  WHERE t.TKE_DATE >= ? AND t.TKE_DATE < ?
  UNION ALL
  SELECT BLL_ARTID, BLL_TGFID, BLL_COUID,
    BLL_QTE, BLL_PXNET, BLL_PXNN
  FROM NEGBLL l
  JOIN NEGBL bl ON bl.BLE_ID = l.BLL_BLEID
  WHERE bl.BLE_DATE >= ? AND bl.BLE_DATE < ?
) v
```

## Correspondance colonnes

| Caisse (CSHTICKETL) | BL (NEGBLL) | Description |
|---|---|---|
| TKL_ARTID | BLL_ARTID | Article |
| TKL_TGFID | BLL_TGFID | Taille |
| TKL_COUID | BLL_COUID | Couleur |
| TKL_QTE | BLL_QTE | Quantité |
| TKL_PXBRUT | BLL_PXBRUT | Prix brut |
| TKL_PXNET | BLL_PXNET | Prix net TTC |
| TKL_PXNNHT | BLL_PXNN | Prix net HT |
| TKL_REMISE | — | % remise (pas dispo en BL) |
| TKE_DATE | BLE_DATE | Date |
| TKE_NUMERO | BLE_NUMERO | Numéro pièce |
| TKE_CLTID | BLE_CLTID | Client |

## Impact
- **Dashboard** : le CA total et stats ne comptent que la caisse → potentiellement sous-estimé
- **Achat/Comparatif** : corrigé (UNION ALL) le 2026-06-09
- **Achat/Taux de sortie** : corrigé (UNION ALL dans sous-requête vendu)
- **Fiche article ventes** : ne montre que la caisse → à corriger si besoin
- **Stats annuelles** : ne compte que la caisse → à corriger si besoin

## Observation
Les articles vendus en BL ont souvent des noms plus courts/génériques (ex: "MACH 7" au lieu de "MACH 7 RUNNING HOMME FROST"). Ce sont probablement des fiches article différentes créées pour le e-commerce.
