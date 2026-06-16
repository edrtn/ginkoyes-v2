// ============================
// Recherche articles
// ============================

export const SEARCH_ARTICLES = `
SELECT
  a.ART_ID, a.ART_NOM, a.ART_REFMRK,
  r.ARF_CHRONO,
  mrk.MRK_NOM AS MARQUE,
  ray.RAY_NOM AS RAYON,
  fam.FAM_NOM AS FAMILLE,
  gen.GRE_NOM AS GENRE
FROM ARTARTICLE a
JOIN ARTREFERENCE r ON r.ARF_ARTID = a.ART_ID
LEFT JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
LEFT JOIN ARTGENRE gen ON gen.GRE_ID = a.ART_GREID
LEFT JOIN NKLSSFAMILLE ssf ON ssf.SSF_ID = a.ART_SSFID
LEFT JOIN NKLFAMILLE fam ON fam.FAM_ID = ssf.SSF_FAMID
LEFT JOIN NKLRAYON ray ON ray.RAY_ID = fam.FAM_RAYID
`;

// Builds dynamic WHERE clause for article search
export function buildArticleSearchWhere(params: {
  q?: string;
  marque?: string;
  rayon?: string;
  famille?: string;
  collection?: string;
}): { where: string; values: unknown[] } {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.q) {
    conditions.push(
      `(UPPER(a.ART_NOM) LIKE ? OR UPPER(a.ART_REFMRK) LIKE ? OR UPPER(r.ARF_CHRONO) LIKE ? OR EXISTS (SELECT 1 FROM ARTCODEBARRE cb WHERE cb.CBI_ARFID = r.ARF_ID AND UPPER(cb.CBI_CB) LIKE ?))`
    );
    const term = `%${params.q.toUpperCase()}%`;
    values.push(term, term, term, term);
  }

  if (params.marque) {
    conditions.push(`UPPER(mrk.MRK_NOM) = ?`);
    values.push(params.marque.toUpperCase());
  }

  if (params.rayon) {
    conditions.push(`UPPER(ray.RAY_NOM) = ?`);
    values.push(params.rayon.toUpperCase());
  }

  if (params.famille) {
    conditions.push(`UPPER(fam.FAM_NOM) = ?`);
    values.push(params.famille.toUpperCase());
  }

  if (params.collection) {
    // Need join to ARTCOLART + ARTCOLLECTION
    conditions.push(
      `EXISTS (SELECT 1 FROM ARTCOLART ca2 JOIN ARTCOLLECTION col2 ON col2.COL_ID = ca2.CAR_COLID WHERE ca2.CAR_ARTID = a.ART_ID AND UPPER(col2.COL_NOM) LIKE ?)`
    );
    values.push(`%${params.collection.toUpperCase()}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, values };
}

// ============================
// Fiche article détaillée
// ============================

export const ARTICLE_DETAIL = `
SELECT a.ART_ID, a.ART_NOM, a.ART_REFMRK, a.ART_CODE, a.ART_CODEFOURN,
       r.ARF_CHRONO AS REF_GINKOIA, r.ARF_ID,
       mrk.MRK_NOM AS MARQUE,
       ray.RAY_NOM AS RAYON,
       fam.FAM_NOM AS FAMILLE,
       ssf.SSF_NOM AS SOUS_FAMILLE,
       gen.GRE_NOM AS GENRE,
       cla.CLA_NOM AS CLASSEMENT
FROM ARTARTICLE a
JOIN ARTREFERENCE r ON r.ARF_ARTID = a.ART_ID
LEFT JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
LEFT JOIN ARTGENRE gen ON gen.GRE_ID = a.ART_GREID
LEFT JOIN NKLSSFAMILLE ssf ON ssf.SSF_ID = a.ART_SSFID
LEFT JOIN NKLFAMILLE fam ON fam.FAM_ID = ssf.SSF_FAMID
LEFT JOIN NKLRAYON ray ON ray.RAY_ID = fam.FAM_RAYID
LEFT JOIN ARTCLAITEM ci ON ci.CIT_ICLID = r.ARF_ICLID1
LEFT JOIN ARTCLASSEMENT cla ON cla.CLA_ID = ci.CIT_CLAID
WHERE a.ART_ID = ?
`;

export const ARTICLE_COLLECTIONS = `
SELECT col.COL_NOM AS SAISON
FROM ARTCOLART ca
JOIN ARTCOLLECTION col ON col.COL_ID = ca.CAR_COLID
WHERE ca.CAR_ARTID = ?
`;

export const ARTICLE_BARCODES = `
SELECT cb.CBI_CB
FROM ARTCODEBARRE cb
JOIN ARTREFERENCE r ON r.ARF_ID = cb.CBI_ARFID
WHERE r.ARF_ARTID = ?
`;

// ============================
// Stock
// ============================

export const ARTICLE_STOCK = `
SELECT s.STC_QTE AS QTE, s.STC_PUMP AS PRIX_ACHAT,
       t.TGF_NOM AS TAILLE, cou.COU_NOM AS COULEUR,
       cou.COU_CODE AS COULEUR_CODE, cou.COU_ARTID AS COULEUR_ARTID
FROM AGRSTOCKCOUR s
LEFT JOIN PLXTAILLESGF t ON t.TGF_ID = s.STC_TGFID
LEFT JOIN PLXCOULEUR cou ON cou.COU_ID = s.STC_COUID
WHERE s.STC_ARTID = ?
ORDER BY cou.COU_NOM, t.TGF_NOM
`;

export const STOCK_GLOBAL = `
SELECT
  a.ART_ID, a.ART_NOM, a.ART_REFMRK,
  mrk.MRK_NOM AS MARQUE,
  ray.RAY_NOM AS RAYON,
  SUM(s.STC_QTE) AS STOCK_TOTAL,
  SUM(s.STC_QTE * s.STC_PUMP) AS VALORISATION
FROM AGRSTOCKCOUR s
JOIN ARTARTICLE a ON a.ART_ID = s.STC_ARTID
LEFT JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
LEFT JOIN NKLSSFAMILLE ssf ON ssf.SSF_ID = a.ART_SSFID
LEFT JOIN NKLFAMILLE fam ON fam.FAM_ID = ssf.SSF_FAMID
LEFT JOIN NKLRAYON ray ON ray.RAY_ID = fam.FAM_RAYID
`;

export function buildStockWhere(params: {
  marque?: string;
  rayon?: string;
  famille?: string;
  collection?: string;
  q?: string;
}): { where: string; values: unknown[] } {
  const conditions: string[] = ["s.STC_QTE <> 0"];
  const values: unknown[] = [];

  if (params.q) {
    conditions.push(`(UPPER(a.ART_NOM) LIKE ? OR UPPER(a.ART_REFMRK) LIKE ?)`);
    const term = `%${params.q.toUpperCase()}%`;
    values.push(term, term);
  }

  if (params.marque) {
    conditions.push(`UPPER(mrk.MRK_NOM) = ?`);
    values.push(params.marque.toUpperCase());
  }

  if (params.rayon) {
    conditions.push(`UPPER(ray.RAY_NOM) = ?`);
    values.push(params.rayon.toUpperCase());
  }

  if (params.famille) {
    conditions.push(`UPPER(fam.FAM_NOM) = ?`);
    values.push(params.famille.toUpperCase());
  }

  if (params.collection) {
    conditions.push(
      `EXISTS (SELECT 1 FROM ARTCOLART ca2 JOIN ARTCOLLECTION col2 ON col2.COL_ID = ca2.CAR_COLID WHERE ca2.CAR_ARTID = a.ART_ID AND UPPER(col2.COL_NOM) LIKE ?)`
    );
    values.push(`%${params.collection.toUpperCase()}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, values };
}

// ============================
// Ventes
// ============================

export const ARTICLE_VENTES = `
SELECT v.SOURCE, v.DATE_VENTE, v.NUMERO,
       v.NOM, v.QTE, v.PXBRUT, v.REMISE, v.PXNET,
       IF(tg.TGF_CORRES IS NOT NULL AND tg.TGF_CORRES <> '', tg.TGF_CORRES, tg.TGF_NOM) AS TAILLE,
       cou.COU_NOM AS COULEUR
FROM (
  SELECT 'CAISSE' AS SOURCE, t.TKE_DATE AS DATE_VENTE, t.TKE_NUMERO AS NUMERO,
         l.TKL_NOM AS NOM, l.TKL_QTE AS QTE, l.TKL_PXBRUT AS PXBRUT,
         l.TKL_REMISE AS REMISE, l.TKL_PXNET AS PXNET,
         l.TKL_TGFID AS TGFID, l.TKL_COUID AS COUID
  FROM CSHTICKETL l
  JOIN CSHTICKET t ON t.TKE_ID = l.TKL_TKEID
  WHERE l.TKL_ARTID = ?
  UNION ALL
  SELECT IF(bl.BLE_WEB = 1, 'WEB', 'BL') AS SOURCE,
         bl.BLE_DATE AS DATE_VENTE, bl.BLE_NUMERO AS NUMERO,
         NULL AS NOM, l.BLL_QTE AS QTE, l.BLL_PXBRUT AS PXBRUT,
         IF(l.BLL_PXBRUT > 0, ROUND((1.0 - 1.0 * l.BLL_PXNET / l.BLL_PXBRUT) * 100, 2), 0) AS REMISE,
         l.BLL_PXNET AS PXNET,
         l.BLL_TGFID AS TGFID, l.BLL_COUID AS COUID
  FROM NEGBLL l
  JOIN NEGBL bl ON bl.BLE_ID = l.BLL_BLEID
  WHERE l.BLL_ARTID IN (
    SELECT a2.ART_ID FROM ARTARTICLE a2
    WHERE a2.ART_REFMRK LIKE CONCAT(?, '%')
  )
) v
LEFT JOIN PLXTAILLESGF tg ON tg.TGF_ID = v.TGFID
LEFT JOIN PLXCOULEUR cou ON cou.COU_ID = v.COUID
ORDER BY v.DATE_VENTE DESC
`;

// ============================
// Réceptions
// ============================

export const ARTICLE_RECEPTIONS = `
SELECT br.BRE_ID, br.BRE_DATE, br.BRE_NUMERO, br.BRE_NUMFOURN,
       f.FOU_NOM,
       l.BRL_QTE, l.BRL_PXACHAT, l.BRL_PXVENTE,
       tg.TGF_NOM AS TAILLE, cou.COU_NOM AS COULEUR
FROM RECBRL l
JOIN RECBR br ON br.BRE_ID = l.BRL_BREID
LEFT JOIN ARTFOURN f ON f.FOU_ID = br.BRE_FOUID
LEFT JOIN PLXTAILLESGF tg ON tg.TGF_ID = l.BRL_TGFID
LEFT JOIN PLXCOULEUR cou ON cou.COU_ID = l.BRL_COUID
WHERE l.BRL_ARTID = ?
ORDER BY br.BRE_DATE DESC, tg.TGF_NOM
`;

// ============================
// Réception — Détail d'un BR
// ============================

export const RECEPTION_HEADER = `
SELECT br.BRE_ID, br.BRE_DATE, br.BRE_NUMERO, br.BRE_NUMFOURN,
       f.FOU_NOM,
       col.COL_NOM AS COLLECTION
FROM RECBR br
LEFT JOIN ARTFOURN f ON f.FOU_ID = br.BRE_FOUID
LEFT JOIN ARTCOLLECTION col ON col.COL_ID = br.BRE_COLID
WHERE br.BRE_ID = ?
`;

export const RECEPTION_LINES = `
SELECT l.BRL_ID, l.BRL_QTE, l.BRL_PXACHAT, l.BRL_PXVENTE,
       a.ART_ID, a.ART_NOM, a.ART_REFMRK,
       mrk.MRK_NOM AS MARQUE,
       tg.TGF_NOM AS TAILLE, cou.COU_NOM AS COULEUR, cou.COU_CODE AS COULEUR_CODE
FROM RECBRL l
JOIN ARTARTICLE a ON a.ART_ID = l.BRL_ARTID
LEFT JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
LEFT JOIN PLXTAILLESGF tg ON tg.TGF_ID = l.BRL_TGFID
LEFT JOIN PLXCOULEUR cou ON cou.COU_ID = l.BRL_COUID
WHERE l.BRL_BREID = ?
ORDER BY a.ART_NOM, cou.COU_NOM, tg.TGF_NOM
`;

// ============================
// Réceptions — Liste des derniers BR
// ============================

export const RECENT_RECEPTIONS = `
SELECT br.BRE_ID, br.BRE_DATE, br.BRE_NUMERO, br.BRE_NUMFOURN,
       f.FOU_NOM,
       COUNT(DISTINCT l.BRL_ARTID) AS NB_ARTICLES,
       SUM(l.BRL_QTE) AS QTE_TOTALE,
       SUM(l.BRL_QTE * l.BRL_PXACHAT) AS MONTANT_ACHAT
FROM RECBR br
JOIN RECBRL l ON l.BRL_BREID = br.BRE_ID
LEFT JOIN ARTFOURN f ON f.FOU_ID = br.BRE_FOUID
GROUP BY br.BRE_ID, br.BRE_DATE, br.BRE_NUMERO, br.BRE_NUMFOURN, f.FOU_NOM
ORDER BY br.BRE_DATE DESC
LIMIT 200
`;

// ============================
// Dashboard stats (with date filters for performance)
// ============================

export const DASHBOARD_CA_TOTAL = `
SELECT SUM(TKE_TOTALTTC) AS CA_TOTAL, COUNT(*) AS NB_TICKETS
FROM CSHTICKET
WHERE TKE_DATE >= ? AND TKE_DATE < ?
`;

export const DASHBOARD_TOP_ARTICLES = `
SELECT
  a.ART_ID, a.ART_NOM, a.ART_REFMRK,
  v.mrk_nom AS MARQUE,
  v.ray_nom AS RAYON,
  SUM(v.sum_qte) AS QTE_VENDUE,
  SUM(v.sum_pxnet) AS CA_ARTICLE
FROM _ventes_daily v
JOIN ARTARTICLE a ON a.ART_ID = v.art_id
WHERE v.vente_date >= ? AND v.vente_date < ?
GROUP BY a.ART_ID, a.ART_NOM, a.ART_REFMRK, v.mrk_nom, v.ray_nom
ORDER BY CA_ARTICLE DESC
LIMIT 10
`;

export const DASHBOARD_CA_PAR_RAYON = `
SELECT ray_nom AS RAYON, SUM(sum_pxnet) AS CA
FROM _ventes_daily
WHERE vente_date >= ? AND vente_date < ?
  AND ray_nom IS NOT NULL AND TRIM(ray_nom) <> ''
GROUP BY ray_nom
ORDER BY CA DESC
`;

export const DASHBOARD_CA_PAR_MARQUE = `
SELECT mrk_nom AS MARQUE, SUM(sum_pxnet) AS CA
FROM _ventes_daily
WHERE vente_date >= ? AND vente_date < ?
  AND mrk_nom IS NOT NULL AND TRIM(mrk_nom) <> ''
GROUP BY mrk_nom
ORDER BY CA DESC
LIMIT 15
`;

export const DASHBOARD_CA_MENSUEL = `
SELECT YEAR(vente_date) AS ANNEE,
       MONTH(vente_date) AS MOIS,
       SUM(sum_pxnet) AS CA
FROM _ventes_daily
WHERE vente_date >= ? AND vente_date < ?
GROUP BY YEAR(vente_date), MONTH(vente_date)
ORDER BY ANNEE, MOIS
`;

// ============================
// Stats annuelles (CA, panier moyen, indice de vente)
// ============================

export const STATS_ANNUELLES = `
SELECT
  YEAR(t.TKE_DATE) AS ANNEE,
  SUM(t.TKE_TOTALTTC) AS CA,
  COUNT(t.TKE_ID) AS NB_TICKETS,
  COALESCE(v.NB_ARTICLES, 0) AS NB_ARTICLES
FROM CSHTICKET t
LEFT JOIN (
  SELECT YEAR(vente_date) AS annee, SUM(sum_qte) AS NB_ARTICLES
  FROM _ventes_daily
  WHERE source = 'CAISSE'
  GROUP BY YEAR(vente_date)
) v ON v.annee = YEAR(t.TKE_DATE)
WHERE t.TKE_DATE IS NOT NULL
GROUP BY YEAR(t.TKE_DATE), v.NB_ARTICLES
ORDER BY ANNEE
`;

// ============================
// Filtres (pour les dropdowns)
// ============================

export const LIST_MARQUES = `
SELECT DISTINCT mrk.MRK_NOM AS MARQUE
FROM ARTMARQUE mrk
WHERE mrk.MRK_NOM IS NOT NULL
ORDER BY mrk.MRK_NOM
`;

export const BRANDS_WITH_STOCK = `
SELECT mrk.MRK_NOM AS MARQUE,
       COUNT(DISTINCT a.ART_ID) AS NB_ARTICLES,
       COALESCE(SUM(s.STC_QTE), 0) AS STOCK_TOTAL
FROM AGRSTOCKCOUR s
JOIN ARTARTICLE a ON a.ART_ID = s.STC_ARTID
LEFT JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
WHERE mrk.MRK_NOM IS NOT NULL AND s.STC_QTE > 0
GROUP BY mrk.MRK_NOM
ORDER BY mrk.MRK_NOM
`;

export const LIST_RAYONS = `
SELECT DISTINCT ray.RAY_NOM AS RAYON
FROM NKLRAYON ray
WHERE ray.RAY_NOM IS NOT NULL
ORDER BY ray.RAY_NOM
`;

export const LIST_FAMILLES = `
SELECT DISTINCT fam.FAM_NOM AS FAMILLE
FROM NKLFAMILLE fam
WHERE fam.FAM_NOM IS NOT NULL
ORDER BY fam.FAM_NOM
`;

// ============================
// Collections (pour dropdown Achat)
// ============================

export const LIST_COLLECTIONS = `
SELECT COL_ID, COL_NOM FROM ARTCOLLECTION
WHERE COL_NOM IS NOT NULL AND TRIM(COL_NOM) <> ''
ORDER BY COL_NOM DESC
`;

export const INSERT_COLLECTION = `
INSERT INTO ARTCOLLECTION (COL_ID, COL_NOM)
VALUES ((SELECT COALESCE(MAX(c.COL_ID),0)+1 FROM ARTCOLLECTION c), ?)
`;

// ============================
// Achat — Recap commande N-1
// ============================

export const ACHAT_RECAP_COMMANDE = `
SELECT
  COUNT(DISTINCT l.CDL_ARTID) AS NB_MODELES,
  SUM(l.CDL_QTE) AS QTE_TOTALE,
  SUM(l.CDL_QTE * l.CDL_PXACHAT) AS MONTANT_ACHAT_BRUT,
  SUM(l.CDL_QTE * l.CDL_PXACHAT
    * (1 - COALESCE(l.CDL_REMISE1,0)/100.0)
    * (1 - COALESCE(l.CDL_REMISE2,0)/100.0)
    * (1 - COALESCE(l.CDL_REMISE3,0)/100.0)
  ) AS MONTANT_ACHAT_NET,
  SUM(l.CDL_QTE * l.CDL_PXVENTE) AS MONTANT_VENTE,
  SUM(l.CDL_QTE * l.CDL_PXACHAT * COALESCE(l.CDL_REMISE1,0)/100.0) AS REMISE1_TOTAL,
  SUM(l.CDL_QTE * l.CDL_PXACHAT
    * (1 - COALESCE(l.CDL_REMISE1,0)/100.0)
    * COALESCE(l.CDL_REMISE2,0)/100.0
  ) AS REMISE2_TOTAL,
  SUM(l.CDL_QTE * l.CDL_PXACHAT
    * (1 - COALESCE(l.CDL_REMISE1,0)/100.0)
    * (1 - COALESCE(l.CDL_REMISE2,0)/100.0)
    * COALESCE(l.CDL_REMISE3,0)/100.0
  ) AS REMISE3_TOTAL
FROM COMBCDEL l
JOIN COMBCDE cde ON cde.CDE_ID = l.CDL_CDEID
JOIN ARTARTICLE a ON a.ART_ID = l.CDL_ARTID
JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
WHERE cde.CDE_COLID = ? AND UPPER(mrk.MRK_NOM) = ?
`;

// ============================
// Achat — Comparatif ventes N-1 vs N-2
// ============================

export const ACHAT_VENTES_COMPARATIF = `
SELECT
  gre_nom AS GENRE,
  SUM(sum_pxnet) AS CA_TTC,
  SUM(sum_pxnnht) AS CA_HT,
  SUM(sum_qte) AS QTE,
  0 AS COUT_TOTAL
FROM _ventes_daily
WHERE vente_date >= ? AND vente_date < ?
  AND UPPER(mrk_nom) = ?
GROUP BY gre_nom
`;

// ============================
// Achat — Taux de sortie collection N-1
// ============================

// Params: collectionId, collectionId, fromDate, toDate, marque
export const ACHAT_TAUX_SORTIE = `
SELECT
  a.ART_ID, a.ART_NOM, a.ART_REFMRK,
  gen.GRE_NOM AS GENRE,
  ray.RAY_NOM AS RAYON, fam.FAM_NOM AS FAMILLE, ssf.SSF_NOM AS SOUS_FAMILLE,
  cou.COU_NOM AS COULEUR,
  COALESCE(rec.QTE_RECUE, 0) AS QTE_RECUE,
  COALESCE(ven.QTE_VENDUE, 0) AS QTE_VENDUE,
  cmd.MONTANT_ACHAT_NET, cmd.PX_VENTE_UNITAIRE
FROM (
  SELECT l.CDL_ARTID AS ART_ID, l.CDL_COUID AS COU_ID,
    SUM(l.CDL_QTE * l.CDL_PXACHAT
      * (1 - COALESCE(l.CDL_REMISE1,0)/100.0)
      * (1 - COALESCE(l.CDL_REMISE2,0)/100.0)
      * (1 - COALESCE(l.CDL_REMISE3,0)/100.0)) AS MONTANT_ACHAT_NET,
    MAX(l.CDL_PXVENTE) AS PX_VENTE_UNITAIRE
  FROM COMBCDEL l
  JOIN COMBCDE cde ON cde.CDE_ID = l.CDL_CDEID
  WHERE cde.CDE_COLID = ?
  GROUP BY l.CDL_ARTID, l.CDL_COUID
) cmd
JOIN ARTARTICLE a ON a.ART_ID = cmd.ART_ID
JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
LEFT JOIN ARTGENRE gen ON gen.GRE_ID = a.ART_GREID
LEFT JOIN NKLSSFAMILLE ssf ON ssf.SSF_ID = a.ART_SSFID
LEFT JOIN NKLFAMILLE fam ON fam.FAM_ID = ssf.SSF_FAMID
LEFT JOIN NKLRAYON ray ON ray.RAY_ID = fam.FAM_RAYID
LEFT JOIN PLXCOULEUR cou ON cou.COU_ID = cmd.COU_ID
LEFT JOIN (
  SELECT l.BRL_ARTID AS ART_ID, l.BRL_COUID AS COU_ID, SUM(l.BRL_QTE) AS QTE_RECUE
  FROM RECBRL l
  JOIN RECBR br ON br.BRE_ID = l.BRL_BREID
  WHERE br.BRE_COLID = ?
  GROUP BY l.BRL_ARTID, l.BRL_COUID
) rec ON rec.ART_ID = a.ART_ID AND rec.COU_ID = cmd.COU_ID
LEFT JOIN (
  SELECT ARTID, COUID, SUM(QTE) AS QTE_VENDUE FROM (
    SELECT TKL_ARTID AS ARTID, TKL_COUID AS COUID, TKL_QTE AS QTE
    FROM CSHTICKETL
    JOIN CSHTICKET t ON t.TKE_ID = TKL_TKEID
    WHERE t.TKE_DATE >= ? AND t.TKE_DATE < ?
    UNION ALL
    SELECT BLL_ARTID, BLL_COUID, BLL_QTE
    FROM NEGBLL
    JOIN NEGBL bl ON bl.BLE_ID = BLL_BLEID
    WHERE bl.BLE_DATE >= ? AND bl.BLE_DATE < ?
  ) v GROUP BY ARTID, COUID
) ven ON ven.ARTID = a.ART_ID AND ven.COUID = cmd.COU_ID
WHERE UPPER(mrk.MRK_NOM) = ?
ORDER BY ray.RAY_NOM, fam.FAM_NOM, a.ART_REFMRK, cou.COU_NOM
`;

// ============================
// Achat — Détail des ventes individuelles
// ============================

export const ACHAT_VENTES_DETAIL = `
  SELECT
    a.ART_ID,
    v.SOURCE, v.DATE_VENTE, v.NUMERO,
    a.ART_NOM, a.ART_REFMRK,
    gen.GRE_NOM AS GENRE,
    cou.COU_NOM AS COULEUR,
    tgf.TGF_NOM AS TAILLE,
    ray.RAY_NOM AS RAYON, fam.FAM_NOM AS FAMILLE,
    v.QTE, v.PX_BRUT, v.PX_NET_TTC, v.PX_NET_HT
  FROM (
    SELECT 'CAISSE' AS SOURCE, t.TKE_DATE AS DATE_VENTE, t.TKE_NUMERO AS NUMERO,
      l.TKL_ARTID AS ARTID, l.TKL_TGFID AS TGFID, l.TKL_COUID AS COUID,
      l.TKL_QTE AS QTE, l.TKL_PXBRUT AS PX_BRUT, l.TKL_PXNET AS PX_NET_TTC, l.TKL_PXNNHT AS PX_NET_HT
    FROM CSHTICKETL l
    JOIN CSHTICKET t ON t.TKE_ID = l.TKL_TKEID
    WHERE t.TKE_DATE >= ? AND t.TKE_DATE < ?
    UNION ALL
    SELECT 'BL/INTERNET' AS SOURCE, bl.BLE_DATE AS DATE_VENTE, bl.BLE_NUMERO AS NUMERO,
      l.BLL_ARTID, l.BLL_TGFID, l.BLL_COUID,
      l.BLL_QTE, l.BLL_PXBRUT, l.BLL_PXNET, l.BLL_PXNN
    FROM NEGBLL l
    JOIN NEGBL bl ON bl.BLE_ID = l.BLL_BLEID
    WHERE bl.BLE_DATE >= ? AND bl.BLE_DATE < ?
  ) v
  JOIN ARTARTICLE a ON a.ART_ID = v.ARTID
  JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
  LEFT JOIN ARTGENRE gen ON gen.GRE_ID = a.ART_GREID
  LEFT JOIN PLXCOULEUR cou ON cou.COU_ID = v.COUID
  LEFT JOIN PLXTAILLESGF tgf ON tgf.TGF_ID = v.TGFID
  LEFT JOIN NKLSSFAMILLE ssf ON ssf.SSF_ID = a.ART_SSFID
  LEFT JOIN NKLFAMILLE fam ON fam.FAM_ID = ssf.SSF_FAMID
  LEFT JOIN NKLRAYON ray ON ray.RAY_ID = fam.FAM_RAYID
  WHERE UPPER(mrk.MRK_NOM) = ?
  ORDER BY v.DATE_VENTE, a.ART_NOM, cou.COU_NOM
`;

// ============================
// Page Marque
// ============================

export const BRAND_STATS = `
SELECT
  COUNT(DISTINCT a.ART_ID) AS NB_ARTICLES,
  COALESCE(SUM(s.STC_QTE), 0) AS TOTAL_QTE,
  COALESCE(SUM(s.STC_QTE * s.STC_PUMP), 0) AS TOTAL_VALOR
FROM AGRSTOCKCOUR s
JOIN ARTARTICLE a ON a.ART_ID = s.STC_ARTID
LEFT JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
WHERE UPPER(mrk.MRK_NOM) = UPPER(?)
  AND s.STC_QTE > 0
`;

export const BRAND_ARTICLES = `
SELECT a.ART_ID, a.ART_NOM, a.ART_REFMRK, r.ARF_CHRONO AS REF_GINKOIA,
       ray.RAY_NOM AS RAYON, fam.FAM_NOM AS FAMILLE, gen.GRE_NOM AS GENRE,
       (SELECT MAX(col.COL_NOM) FROM ARTCOLART ca JOIN ARTCOLLECTION col ON col.COL_ID = ca.CAR_COLID WHERE ca.CAR_ARTID = a.ART_ID) AS SAISON,
       COALESCE(SUM(s.STC_QTE), 0) AS STOCK
FROM ARTARTICLE a
LEFT JOIN ARTREFERENCE r ON r.ARF_ARTID = a.ART_ID
LEFT JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
LEFT JOIN NKLSSFAMILLE ssf ON ssf.SSF_ID = a.ART_SSFID
LEFT JOIN NKLFAMILLE fam ON fam.FAM_ID = ssf.SSF_FAMID
LEFT JOIN NKLRAYON ray ON ray.RAY_ID = fam.FAM_RAYID
LEFT JOIN ARTGENRE gen ON gen.GRE_ID = a.ART_GREID
LEFT JOIN AGRSTOCKCOUR s ON s.STC_ARTID = a.ART_ID
WHERE UPPER(mrk.MRK_NOM) = UPPER(?)
GROUP BY a.ART_ID, a.ART_NOM, a.ART_REFMRK, r.ARF_CHRONO,
         ray.RAY_NOM, fam.FAM_NOM, gen.GRE_NOM
HAVING COALESCE(SUM(s.STC_QTE), 0) > 0
ORDER BY a.ART_NOM
`;

export const BRAND_VENTES = `
SELECT v.SOURCE, v.DATE_VENTE, v.NUMERO,
       a.ART_NOM, a.ART_ID,
       v.QTE, v.PXBRUT, v.REMISE, v.PXNET,
       IF(tg.TGF_CORRES IS NOT NULL AND tg.TGF_CORRES <> '', tg.TGF_CORRES, tg.TGF_NOM) AS TAILLE,
       cou.COU_NOM AS COULEUR
FROM (
  SELECT 'CAISSE' AS SOURCE, t.TKE_DATE AS DATE_VENTE, t.TKE_NUMERO AS NUMERO,
         l.TKL_ARTID AS ARTID,
         l.TKL_QTE AS QTE, l.TKL_PXBRUT AS PXBRUT,
         l.TKL_REMISE AS REMISE, l.TKL_PXNET AS PXNET,
         l.TKL_TGFID AS TGFID, l.TKL_COUID AS COUID
  FROM CSHTICKETL l
  JOIN CSHTICKET t ON t.TKE_ID = l.TKL_TKEID
  UNION ALL
  SELECT IF(bl.BLE_WEB = 1, 'WEB', 'BL') AS SOURCE,
         bl.BLE_DATE AS DATE_VENTE, bl.BLE_NUMERO AS NUMERO,
         l.BLL_ARTID AS ARTID,
         l.BLL_QTE AS QTE, l.BLL_PXBRUT AS PXBRUT,
         IF(l.BLL_PXBRUT > 0, ROUND((1.0 - 1.0 * l.BLL_PXNET / l.BLL_PXBRUT) * 100, 2), 0) AS REMISE,
         l.BLL_PXNET AS PXNET,
         l.BLL_TGFID AS TGFID, l.BLL_COUID AS COUID
  FROM NEGBLL l
  JOIN NEGBL bl ON bl.BLE_ID = l.BLL_BLEID
) v
JOIN ARTARTICLE a ON a.ART_ID = v.ARTID
JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
LEFT JOIN PLXTAILLESGF tg ON tg.TGF_ID = v.TGFID
LEFT JOIN PLXCOULEUR cou ON cou.COU_ID = v.COUID
WHERE UPPER(mrk.MRK_NOM) = UPPER(?)
ORDER BY v.DATE_VENTE DESC
LIMIT 200
`;

// ============================
// Catégories (Rayons / Familles) avec compteurs
// ============================

export const RAYONS_WITH_COUNT = `
SELECT ray.RAY_ID, ray.RAY_NOM,
       COUNT(DISTINCT a.ART_ID) AS articleCount,
       COUNT(DISTINCT fam.FAM_ID) AS familleCount
FROM NKLRAYON ray
JOIN NKLFAMILLE fam ON fam.FAM_RAYID = ray.RAY_ID
JOIN NKLSSFAMILLE ssf ON ssf.SSF_FAMID = fam.FAM_ID
JOIN ARTARTICLE a ON a.ART_SSFID = ssf.SSF_ID
GROUP BY ray.RAY_ID, ray.RAY_NOM
ORDER BY ray.RAY_NOM
`;

export const FAMILLES_WITH_COUNT = `
SELECT fam.FAM_ID, fam.FAM_NOM, fam.FAM_RAYID,
       COUNT(DISTINCT a.ART_ID) AS articleCount
FROM NKLFAMILLE fam
JOIN NKLSSFAMILLE ssf ON ssf.SSF_FAMID = fam.FAM_ID
JOIN ARTARTICLE a ON a.ART_SSFID = ssf.SSF_ID
GROUP BY fam.FAM_ID, fam.FAM_NOM, fam.FAM_RAYID
ORDER BY fam.FAM_NOM
`;

export const ARTICLES_BY_FAMILLE = `
SELECT a.ART_ID, a.ART_NOM, a.ART_REFMRK, r.ARF_CHRONO,
  mrk.MRK_NOM AS MARQUE, gen.GRE_NOM AS GENRE,
  COALESCE(SUM(stc.STC_QTE), 0) AS STOCK_TOTAL
FROM ARTARTICLE a
JOIN ARTREFERENCE r ON r.ARF_ARTID = a.ART_ID
LEFT JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
LEFT JOIN ARTGENRE gen ON gen.GRE_ID = a.ART_GREID
LEFT JOIN NKLSSFAMILLE ssf ON ssf.SSF_ID = a.ART_SSFID
LEFT JOIN NKLFAMILLE fam ON fam.FAM_ID = ssf.SSF_FAMID
LEFT JOIN AGRSTOCKCOUR stc ON stc.STC_ARTID = a.ART_ID
WHERE UPPER(fam.FAM_NOM) = ?
GROUP BY a.ART_ID, a.ART_NOM, a.ART_REFMRK, r.ARF_CHRONO, mrk.MRK_NOM, gen.GRE_NOM
ORDER BY a.ART_NOM
LIMIT 200
`;

export const ACHAT_VENTES_COMPARATIF_PAR_SOURCE = `
SELECT
  source AS SOURCE,
  SUM(sum_pxnet) AS CA_TTC,
  SUM(sum_pxnnht) AS CA_HT,
  SUM(sum_qte) AS QTE,
  0 AS COUT_TOTAL
FROM _ventes_daily
WHERE vente_date >= ? AND vente_date < ?
  AND UPPER(mrk_nom) = ?
GROUP BY source
`;

// ============================
// Pilotage Achats Saisonniers
// ============================

// Score Achat — 1 row par marque pour une collection donnée
// Params: collectionId ×4, fromN, toN, fromN1, toN1
export const PILOTAGE_SCORE_ACHAT = `
SELECT
  mrk.MRK_NOM AS MARQUE,
  COALESCE(cmd.NB_MODELES, 0) AS NB_MODELES,
  COALESCE(cmd.QTE_COMMANDEE, 0) AS QTE_COMMANDEE,
  COALESCE(cmd.MONTANT_ACHAT_NET, 0) AS MONTANT_ACHAT_NET,
  COALESCE(cmd.MONTANT_VENTE, 0) AS MONTANT_VENTE,
  COALESCE(rec.QTE_RECUE, 0) AS QTE_RECUE,
  COALESCE(rec.MONTANT_ACHAT_REC, 0) AS MONTANT_ACHAT_REC,
  COALESCE(rec.MONTANT_VENTE_REC, 0) AS MONTANT_VENTE_REC,
  COALESCE(ven.QTE_VENDUE, 0) AS QTE_VENDUE,
  COALESCE(ven.CA_TTC, 0) AS CA_TTC,
  COALESCE(ven.CA_HT, 0) AS CA_HT,
  COALESCE(ven_n1.CA_TTC, 0) AS CA_TTC_N1,
  COALESCE(stk.QTE_STOCK, 0) AS QTE_STOCK,
  COALESCE(stk.VALORISATION, 0) AS VALORISATION,
  COALESCE(inv.NB_INVENDUS, 0) AS NB_INVENDUS,
  COALESCE(inv.VALEUR_INVENDUS, 0) AS VALEUR_INVENDUS
FROM ARTMARQUE mrk
-- Commandes
LEFT JOIN (
  SELECT a.ART_MRKID,
    COUNT(DISTINCT l.CDL_ARTID) AS NB_MODELES,
    SUM(l.CDL_QTE) AS QTE_COMMANDEE,
    SUM(l.CDL_QTE * l.CDL_PXACHAT
      * (1 - COALESCE(l.CDL_REMISE1,0)/100.0)
      * (1 - COALESCE(l.CDL_REMISE2,0)/100.0)
      * (1 - COALESCE(l.CDL_REMISE3,0)/100.0)) AS MONTANT_ACHAT_NET,
    SUM(l.CDL_QTE * l.CDL_PXVENTE) AS MONTANT_VENTE
  FROM COMBCDEL l
  JOIN COMBCDE cde ON cde.CDE_ID = l.CDL_CDEID
  JOIN ARTARTICLE a ON a.ART_ID = l.CDL_ARTID
  WHERE cde.CDE_COLID = ?
  GROUP BY a.ART_MRKID
) cmd ON cmd.ART_MRKID = mrk.MRK_ID
-- Réceptions
LEFT JOIN (
  SELECT a.ART_MRKID,
    SUM(l.BRL_QTE) AS QTE_RECUE,
    SUM(l.BRL_QTE * l.BRL_PXACHAT) AS MONTANT_ACHAT_REC,
    SUM(l.BRL_QTE * l.BRL_PXVENTE) AS MONTANT_VENTE_REC
  FROM RECBRL l
  JOIN RECBR br ON br.BRE_ID = l.BRL_BREID
  JOIN ARTARTICLE a ON a.ART_ID = l.BRL_ARTID
  WHERE br.BRE_COLID = ?
  GROUP BY a.ART_MRKID
) rec ON rec.ART_MRKID = mrk.MRK_ID
-- Ventes période N (articles de la collection)
LEFT JOIN (
  SELECT a.ART_MRKID,
    SUM(v.sum_qte) AS QTE_VENDUE,
    SUM(v.sum_pxnet) AS CA_TTC,
    SUM(v.sum_pxnnht) AS CA_HT
  FROM _ventes_daily v
  JOIN ARTARTICLE a ON a.ART_ID = v.art_id
  WHERE v.vente_date >= ? AND v.vente_date < ?
    AND EXISTS (SELECT 1 FROM ARTCOLART ca WHERE ca.CAR_ARTID = a.ART_ID AND ca.CAR_COLID = ?)
  GROUP BY a.ART_MRKID
) ven ON ven.ART_MRKID = mrk.MRK_ID
-- Ventes période N-1 (mêmes articles, période précédente)
LEFT JOIN (
  SELECT a.ART_MRKID,
    SUM(v.sum_pxnet) AS CA_TTC
  FROM _ventes_daily v
  JOIN ARTARTICLE a ON a.ART_ID = v.art_id
  WHERE v.vente_date >= ? AND v.vente_date < ?
    AND EXISTS (SELECT 1 FROM ARTCOLART ca WHERE ca.CAR_ARTID = a.ART_ID AND ca.CAR_COLID = ?)
  GROUP BY a.ART_MRKID
) ven_n1 ON ven_n1.ART_MRKID = mrk.MRK_ID
-- Stock actuel (articles de la collection)
LEFT JOIN (
  SELECT a.ART_MRKID,
    SUM(s.STC_QTE) AS QTE_STOCK,
    SUM(s.STC_QTE * s.STC_PUMP) AS VALORISATION
  FROM AGRSTOCKCOUR s
  JOIN ARTARTICLE a ON a.ART_ID = s.STC_ARTID
  WHERE EXISTS (SELECT 1 FROM ARTCOLART ca WHERE ca.CAR_ARTID = a.ART_ID AND ca.CAR_COLID = ?)
    AND s.STC_QTE > 0
  GROUP BY a.ART_MRKID
) stk ON stk.ART_MRKID = mrk.MRK_ID
-- Invendus (stock > 0, aucune vente depuis 12 mois)
LEFT JOIN (
  SELECT a.ART_MRKID,
    COUNT(DISTINCT a.ART_ID) AS NB_INVENDUS,
    SUM(s.STC_QTE * s.STC_PUMP) AS VALEUR_INVENDUS
  FROM AGRSTOCKCOUR s
  JOIN ARTARTICLE a ON a.ART_ID = s.STC_ARTID
  WHERE EXISTS (SELECT 1 FROM ARTCOLART ca WHERE ca.CAR_ARTID = a.ART_ID AND ca.CAR_COLID = ?)
    AND s.STC_QTE > 0
    AND NOT EXISTS (
      SELECT 1 FROM _ventes_daily vd
      WHERE vd.art_id = a.ART_ID
        AND vd.vente_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
    )
  GROUP BY a.ART_MRKID
) inv ON inv.ART_MRKID = mrk.MRK_ID
WHERE (cmd.ART_MRKID IS NOT NULL OR rec.ART_MRKID IS NOT NULL
       OR ven.ART_MRKID IS NOT NULL OR stk.ART_MRKID IS NOT NULL)
ORDER BY COALESCE(ven.CA_TTC, 0) DESC
`;

// Courbe d'écoulement — qté vendue par mois après 1ère réception, par marque
// Params: collectionId ×2
export const PILOTAGE_SELL_THROUGH_CURVE = `
SELECT
  mrk.MRK_NOM AS MARQUE,
  TIMESTAMPDIFF(MONTH, first_rec.FIRST_REC_DATE, v.vente_date) AS MOIS_APRES_RECEPTION,
  SUM(v.sum_qte) AS QTE_VENDUE
FROM _ventes_daily v
JOIN ARTARTICLE a ON a.ART_ID = v.art_id
JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
JOIN (
  SELECT l.BRL_ARTID, MIN(br.BRE_DATE) AS FIRST_REC_DATE
  FROM RECBRL l
  JOIN RECBR br ON br.BRE_ID = l.BRL_BREID
  WHERE br.BRE_COLID = ?
  GROUP BY l.BRL_ARTID
) first_rec ON first_rec.BRL_ARTID = a.ART_ID
WHERE EXISTS (SELECT 1 FROM ARTCOLART ca WHERE ca.CAR_ARTID = a.ART_ID AND ca.CAR_COLID = ?)
  AND v.vente_date >= first_rec.FIRST_REC_DATE
  AND TIMESTAMPDIFF(MONTH, first_rec.FIRST_REC_DATE, v.vente_date) BETWEEN 0 AND 24
GROUP BY mrk.MRK_NOM, TIMESTAMPDIFF(MONTH, first_rec.FIRST_REC_DATE, v.vente_date)
ORDER BY mrk.MRK_NOM, MOIS_APRES_RECEPTION
`;

// Articles invendus — stock > 0, aucune vente depuis 12 mois
// Params: collectionId
export const PILOTAGE_UNSOLD_ARTICLES = `
SELECT
  a.ART_ID, a.ART_NOM, a.ART_REFMRK,
  mrk.MRK_NOM AS MARQUE,
  ray.RAY_NOM AS RAYON,
  fam.FAM_NOM AS FAMILLE,
  SUM(s.STC_QTE) AS QTE_STOCK,
  SUM(s.STC_QTE * s.STC_PUMP) AS VALEUR_STOCK,
  MAX(last_v.DERNIERE_VENTE) AS DERNIERE_VENTE,
  DATEDIFF(CURDATE(), MAX(last_v.DERNIERE_VENTE)) AS JOURS_SANS_VENTE
FROM AGRSTOCKCOUR s
JOIN ARTARTICLE a ON a.ART_ID = s.STC_ARTID
LEFT JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
LEFT JOIN NKLSSFAMILLE ssf ON ssf.SSF_ID = a.ART_SSFID
LEFT JOIN NKLFAMILLE fam ON fam.FAM_ID = ssf.SSF_FAMID
LEFT JOIN NKLRAYON ray ON ray.RAY_ID = fam.FAM_RAYID
LEFT JOIN (
  SELECT art_id, MAX(vente_date) AS DERNIERE_VENTE
  FROM _ventes_daily
  GROUP BY art_id
) last_v ON last_v.art_id = a.ART_ID
WHERE EXISTS (SELECT 1 FROM ARTCOLART ca WHERE ca.CAR_ARTID = a.ART_ID AND ca.CAR_COLID = ?)
  AND s.STC_QTE > 0
  AND (last_v.DERNIERE_VENTE IS NULL OR last_v.DERNIERE_VENTE < DATE_SUB(CURDATE(), INTERVAL 12 MONTH))
GROUP BY a.ART_ID, a.ART_NOM, a.ART_REFMRK, mrk.MRK_NOM, ray.RAY_NOM, fam.FAM_NOM
ORDER BY VALEUR_STOCK DESC
`;

// Comparaison multi-saisons — 1 row par marque × collection
// Params: dynamique [collectionId1, collectionId2, collectionId3, ...] — IN (?,?,?)
export function buildSeasonComparisonQuery(nbSeasons: number): string {
  const placeholders = Array(nbSeasons).fill("?").join(",");
  return `
SELECT
  mrk.MRK_NOM AS MARQUE,
  col.COL_NOM AS SAISON,
  col.COL_ID AS COL_ID,
  COALESCE(SUM(rec.BRL_QTE), 0) AS QTE_ACHETEE,
  COALESCE(SUM(rec.BRL_QTE * rec.BRL_PXACHAT), 0) AS MONTANT_ACHAT,
  COALESCE(SUM(rec.BRL_QTE * rec.BRL_PXVENTE), 0) AS MONTANT_VENTE,
  COALESCE(stk.QTE_STOCK, 0) AS QTE_STOCK,
  COALESCE(stk.VALORISATION, 0) AS STOCK_VALORISATION
FROM RECBRL rec
JOIN RECBR br ON br.BRE_ID = rec.BRL_BREID
JOIN ARTCOLLECTION col ON col.COL_ID = br.BRE_COLID
JOIN ARTARTICLE a ON a.ART_ID = rec.BRL_ARTID
JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
LEFT JOIN (
  SELECT ca.CAR_COLID, a2.ART_MRKID,
    SUM(s.STC_QTE) AS QTE_STOCK,
    SUM(s.STC_QTE * s.STC_PUMP) AS VALORISATION
  FROM AGRSTOCKCOUR s
  JOIN ARTARTICLE a2 ON a2.ART_ID = s.STC_ARTID
  JOIN ARTCOLART ca ON ca.CAR_ARTID = a2.ART_ID
  WHERE ca.CAR_COLID IN (${placeholders})
    AND s.STC_QTE > 0
  GROUP BY ca.CAR_COLID, a2.ART_MRKID
) stk ON stk.CAR_COLID = col.COL_ID AND stk.ART_MRKID = mrk.MRK_ID
WHERE br.BRE_COLID IN (${placeholders})
GROUP BY mrk.MRK_NOM, col.COL_NOM, col.COL_ID, stk.QTE_STOCK, stk.VALORISATION
ORDER BY mrk.MRK_NOM, col.COL_NOM
`;
}

// Historique des commandes par saison pour une marque
// Params: marqueNom ×6 (cmd, cde-dates, rec, ven, stk, fou)
// Ventes scopées par période de saison (PE=Jan-Jul, AH=Jul-Jan+1)
// et par articles effectivement reçus dans la collection (RECBRL)
// DERNIERE_VENTE = max all-time (non scopé) pour calcul statut
// Tri chronologique : année DESC, AH avant PE (plus récent en haut)
export const PILOTAGE_ORDER_HISTORY = `
SELECT
  col.COL_ID,
  col.COL_NOM AS SAISON,
  MIN(cde.CDE_DATE) AS DATE_CMD_MIN,
  MAX(cde.CDE_DATE) AS DATE_CMD_MAX,
  COALESCE(cmd.QTE_COMMANDEE, 0) AS QTE_COMMANDEE,
  COALESCE(cmd.MONTANT_ACHAT_NET, 0) AS MONTANT_ACHAT_NET,
  COALESCE(rec.QTE_RECUE, 0) AS QTE_RECUE,
  COALESCE(ven.QTE_VENDUE, 0) AS QTE_VENDUE,
  COALESCE(ven.QTE_VENDUE_TOTAL, 0) AS QTE_VENDUE_TOTAL,
  COALESCE(ven.CA_TTC, 0) AS CA_TTC,
  COALESCE(ven.DERNIERE_VENTE, NULL) AS DERNIERE_VENTE,
  COALESCE(stk.QTE_STOCK, 0) AS QTE_STOCK,
  COALESCE(fou.FOU_NOM, '') AS FOURNISSEUR,
  CASE
    WHEN UPPER(col.COL_NOM) LIKE '%PRINTEMPS%' OR UPPER(col.COL_NOM) LIKE '%ETE%'
    THEN CONCAT(REGEXP_SUBSTR(col.COL_NOM, '[0-9]{4}'), '-07-01')
    ELSE CONCAT(CAST(REGEXP_SUBSTR(col.COL_NOM, '[0-9]{4}') AS UNSIGNED) + 1, '-01-01')
  END AS SEASON_TO
FROM ARTCOLLECTION col
-- Commandes
LEFT JOIN (
  SELECT cde2.CDE_COLID,
    SUM(l.CDL_QTE) AS QTE_COMMANDEE,
    SUM(l.CDL_QTE * l.CDL_PXACHAT
      * (1 - COALESCE(l.CDL_REMISE1,0)/100.0)
      * (1 - COALESCE(l.CDL_REMISE2,0)/100.0)
      * (1 - COALESCE(l.CDL_REMISE3,0)/100.0)) AS MONTANT_ACHAT_NET
  FROM COMBCDEL l
  JOIN COMBCDE cde2 ON cde2.CDE_ID = l.CDL_CDEID
  JOIN ARTARTICLE a ON a.ART_ID = l.CDL_ARTID
  JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
  WHERE UPPER(mrk.MRK_NOM) = ?
  GROUP BY cde2.CDE_COLID
) cmd ON cmd.CDE_COLID = col.COL_ID
-- Dates de commande (pour MIN/MAX)
LEFT JOIN COMBCDE cde ON cde.CDE_COLID = col.COL_ID
  AND EXISTS (
    SELECT 1 FROM COMBCDEL l2
    JOIN ARTARTICLE a2 ON a2.ART_ID = l2.CDL_ARTID
    JOIN ARTMARQUE m2 ON m2.MRK_ID = a2.ART_MRKID
    WHERE l2.CDL_CDEID = cde.CDE_ID AND UPPER(m2.MRK_NOM) = ?
  )
-- Réceptions
LEFT JOIN (
  SELECT br.BRE_COLID,
    SUM(l.BRL_QTE) AS QTE_RECUE
  FROM RECBRL l
  JOIN RECBR br ON br.BRE_ID = l.BRL_BREID
  JOIN ARTARTICLE a ON a.ART_ID = l.BRL_ARTID
  JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
  WHERE UPPER(mrk.MRK_NOM) = ?
  GROUP BY br.BRE_COLID
) rec ON rec.BRE_COLID = col.COL_ID
-- Ventes : articles reçus dans cette collection, scopées par période de saison
-- PE YYYY → ventes Jan-Jul YYYY, AH YYYY → ventes Jul YYYY - Jan YYYY+1
-- DERNIERE_VENTE reste non scopée (all-time) pour le calcul du statut
LEFT JOIN (
  SELECT rec_col.BRE_COLID,
    SUM(CASE WHEN v.vente_date >= rec_col.season_from AND v.vente_date < rec_col.season_to
        THEN v.sum_qte ELSE 0 END) AS QTE_VENDUE,
    SUM(v.sum_qte) AS QTE_VENDUE_TOTAL,
    SUM(CASE WHEN v.vente_date >= rec_col.season_from AND v.vente_date < rec_col.season_to
        THEN v.sum_pxnet ELSE 0 END) AS CA_TTC,
    MAX(v.vente_date) AS DERNIERE_VENTE
  FROM _ventes_daily v
  JOIN (
    SELECT DISTINCT br2.BRE_COLID, rl2.BRL_ARTID,
      CASE
        WHEN UPPER(c.COL_NOM) LIKE '%PRINTEMPS%' OR UPPER(c.COL_NOM) LIKE '%ETE%'
        THEN CONCAT(REGEXP_SUBSTR(c.COL_NOM, '[0-9]{4}'), '-01-01')
        ELSE CONCAT(REGEXP_SUBSTR(c.COL_NOM, '[0-9]{4}'), '-07-01')
      END AS season_from,
      CASE
        WHEN UPPER(c.COL_NOM) LIKE '%PRINTEMPS%' OR UPPER(c.COL_NOM) LIKE '%ETE%'
        THEN CONCAT(REGEXP_SUBSTR(c.COL_NOM, '[0-9]{4}'), '-07-01')
        ELSE CONCAT(CAST(REGEXP_SUBSTR(c.COL_NOM, '[0-9]{4}') AS UNSIGNED) + 1, '-01-01')
      END AS season_to
    FROM RECBRL rl2
    JOIN RECBR br2 ON br2.BRE_ID = rl2.BRL_BREID
    JOIN ARTCOLLECTION c ON c.COL_ID = br2.BRE_COLID
    JOIN ARTARTICLE a2 ON a2.ART_ID = rl2.BRL_ARTID
    JOIN ARTMARQUE mrk2 ON mrk2.MRK_ID = a2.ART_MRKID
    WHERE UPPER(mrk2.MRK_NOM) = ?
  ) rec_col ON rec_col.BRL_ARTID = v.art_id
  GROUP BY rec_col.BRE_COLID
) ven ON ven.BRE_COLID = col.COL_ID
-- Stock courant (articles reçus dans cette collection)
LEFT JOIN (
  SELECT rec_stk.BRE_COLID,
    SUM(s.STC_QTE) AS QTE_STOCK
  FROM AGRSTOCKCOUR s
  JOIN (
    SELECT DISTINCT br3.BRE_COLID, rl3.BRL_ARTID
    FROM RECBRL rl3
    JOIN RECBR br3 ON br3.BRE_ID = rl3.BRL_BREID
    JOIN ARTARTICLE a3 ON a3.ART_ID = rl3.BRL_ARTID
    JOIN ARTMARQUE mrk3 ON mrk3.MRK_ID = a3.ART_MRKID
    WHERE UPPER(mrk3.MRK_NOM) = ?
  ) rec_stk ON rec_stk.BRL_ARTID = s.STC_ARTID
  WHERE s.STC_QTE > 0
  GROUP BY rec_stk.BRE_COLID
) stk ON stk.BRE_COLID = col.COL_ID
-- Fournisseur principal (1er BR trouvé)
LEFT JOIN (
  SELECT br.BRE_COLID, f.FOU_NOM,
    ROW_NUMBER() OVER (PARTITION BY br.BRE_COLID ORDER BY br.BRE_DATE) AS rn
  FROM RECBR br
  JOIN ARTFOURN f ON f.FOU_ID = br.BRE_FOUID
  WHERE EXISTS (
    SELECT 1 FROM RECBRL l3
    JOIN ARTARTICLE a4 ON a4.ART_ID = l3.BRL_ARTID
    JOIN ARTMARQUE m3 ON m3.MRK_ID = a4.ART_MRKID
    WHERE l3.BRL_BREID = br.BRE_ID AND UPPER(m3.MRK_NOM) = ?
  )
) fou ON fou.BRE_COLID = col.COL_ID AND fou.rn = 1
WHERE cmd.CDE_COLID IS NOT NULL
   OR rec.BRE_COLID IS NOT NULL
GROUP BY col.COL_ID, col.COL_NOM,
  cmd.QTE_COMMANDEE, cmd.MONTANT_ACHAT_NET,
  rec.QTE_RECUE,
  ven.QTE_VENDUE, ven.QTE_VENDUE_TOTAL, ven.CA_TTC, ven.DERNIERE_VENTE,
  stk.QTE_STOCK, fou.FOU_NOM
ORDER BY
  CAST(REGEXP_SUBSTR(col.COL_NOM, '[0-9]{4}') AS UNSIGNED) DESC,
  CASE
    WHEN UPPER(col.COL_NOM) LIKE '%AUTOMNE%' OR UPPER(col.COL_NOM) LIKE '%HIVER%'
      OR UPPER(col.COL_NOM) LIKE '%AH%' OR UPPER(col.COL_NOM) LIKE '%FW%'
    THEN 0 ELSE 1
  END ASC
`;

// Drill-down articles par marque pour une collection
// Params: collectionId, fromDate, toDate, collectionId, marqueNom
export const PILOTAGE_BRAND_DETAIL = `
SELECT
  a.ART_ID, a.ART_NOM, a.ART_REFMRK,
  ray.RAY_NOM AS RAYON, fam.FAM_NOM AS FAMILLE,
  COALESCE(rec.QTE_RECUE, 0) AS QTE_RECUE,
  COALESCE(ven.QTE_VENDUE, 0) AS QTE_VENDUE,
  COALESCE(stk.QTE_STOCK, 0) AS QTE_STOCK,
  COALESCE(ven.CA_TTC, 0) AS CA_TTC,
  COALESCE(ven.CA_HT, 0) AS CA_HT,
  last_v.DERNIERE_VENTE
FROM ARTARTICLE a
JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
LEFT JOIN NKLSSFAMILLE ssf ON ssf.SSF_ID = a.ART_SSFID
LEFT JOIN NKLFAMILLE fam ON fam.FAM_ID = ssf.SSF_FAMID
LEFT JOIN NKLRAYON ray ON ray.RAY_ID = fam.FAM_RAYID
-- Réceptions de cette collection
LEFT JOIN (
  SELECT l.BRL_ARTID, SUM(l.BRL_QTE) AS QTE_RECUE
  FROM RECBRL l
  JOIN RECBR br ON br.BRE_ID = l.BRL_BREID
  WHERE br.BRE_COLID = ?
  GROUP BY l.BRL_ARTID
) rec ON rec.BRL_ARTID = a.ART_ID
-- Ventes sur la période
LEFT JOIN (
  SELECT v.art_id,
    SUM(v.sum_qte) AS QTE_VENDUE,
    SUM(v.sum_pxnet) AS CA_TTC,
    SUM(v.sum_pxnnht) AS CA_HT
  FROM _ventes_daily v
  WHERE v.vente_date >= ? AND v.vente_date < ?
  GROUP BY v.art_id
) ven ON ven.art_id = a.ART_ID
-- Stock actuel
LEFT JOIN (
  SELECT STC_ARTID, SUM(STC_QTE) AS QTE_STOCK
  FROM AGRSTOCKCOUR
  WHERE STC_QTE > 0
  GROUP BY STC_ARTID
) stk ON stk.STC_ARTID = a.ART_ID
-- Dernière vente
LEFT JOIN (
  SELECT art_id, MAX(vente_date) AS DERNIERE_VENTE
  FROM _ventes_daily
  GROUP BY art_id
) last_v ON last_v.art_id = a.ART_ID
WHERE EXISTS (SELECT 1 FROM ARTCOLART ca WHERE ca.CAR_ARTID = a.ART_ID AND ca.CAR_COLID = ?)
  AND UPPER(mrk.MRK_NOM) = ?
ORDER BY COALESCE(ven.CA_TTC, 0) DESC
`;
