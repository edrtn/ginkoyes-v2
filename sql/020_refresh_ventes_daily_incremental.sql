-- ============================
-- Procedure refresh_ventes_daily_since(p_since_date)
-- Incremental version: DELETE + re-INSERT only for dates >= p_since_date
-- Same logic as refresh_ventes_daily() (CAISSE + WEB/BL + REGUL)
-- The original refresh_ventes_daily() remains available for --full mode
-- ============================

DELIMITER $$

DROP PROCEDURE IF EXISTS refresh_ventes_daily_since$$

CREATE PROCEDURE refresh_ventes_daily_since(IN p_since_date DATE)
BEGIN
  -- Delete existing rows for the affected date range
  DELETE FROM _ventes_daily WHERE vente_date >= p_since_date;

  -- CAISSE : lignes de tickets
  INSERT INTO _ventes_daily
    (vente_date, art_id, mrk_id, mrk_nom, ray_id, ray_nom, gre_id, gre_nom,
     source, sum_qte, sum_pxnet, sum_pxnnht, sum_pxbrut, sum_cout, nb_lines)
  SELECT
    t.TKE_DATE,
    l.TKL_ARTID,
    mrk.MRK_ID,
    mrk.MRK_NOM,
    ray.RAY_ID,
    ray.RAY_NOM,
    gen.GRE_ID,
    gen.GRE_NOM,
    'CAISSE',
    SUM(l.TKL_QTE),
    SUM(l.TKL_PXNET * COALESCE(t.TKE_TOTALTTC / NULLIF(tt.sum_lines, 0), 1)),
    SUM(l.TKL_PXNNHT * COALESCE(t.TKE_TOTALTTC / NULLIF(tt.sum_lines, 0), 1)),
    SUM(l.TKL_PXBRUT),
    SUM(l.TKL_QTE * COALESCE(s.STC_PUMP, 0)),
    COUNT(*)
  FROM CSHTICKETL l
  JOIN CSHTICKET t ON t.TKE_ID = l.TKL_TKEID
  LEFT JOIN (
    SELECT TKL_TKEID, SUM(TKL_PXNET) AS sum_lines
    FROM CSHTICKETL
    WHERE TKL_ARTID > 0
    GROUP BY TKL_TKEID
  ) tt ON tt.TKL_TKEID = l.TKL_TKEID
  JOIN ARTARTICLE a ON a.ART_ID = l.TKL_ARTID
  LEFT JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
  LEFT JOIN ARTGENRE gen ON gen.GRE_ID = a.ART_GREID
  LEFT JOIN NKLSSFAMILLE ssf ON ssf.SSF_ID = a.ART_SSFID
  LEFT JOIN NKLFAMILLE fam ON fam.FAM_ID = ssf.SSF_FAMID
  LEFT JOIN NKLRAYON ray ON ray.RAY_ID = fam.FAM_RAYID
  LEFT JOIN AGRSTOCKCOUR s ON s.STC_ARTID = l.TKL_ARTID
    AND s.STC_TGFID = l.TKL_TGFID AND s.STC_COUID = l.TKL_COUID
  WHERE t.TKE_DATE >= p_since_date
    AND t.TKE_DATE IS NOT NULL
    AND l.TKL_ARTID > 0
  GROUP BY t.TKE_DATE, l.TKL_ARTID, mrk.MRK_ID, mrk.MRK_NOM,
           ray.RAY_ID, ray.RAY_NOM, gen.GRE_ID, gen.GRE_NOM;

  -- WEB + BL : lignes de bons de livraison
  INSERT INTO _ventes_daily
    (vente_date, art_id, mrk_id, mrk_nom, ray_id, ray_nom, gre_id, gre_nom,
     source, sum_qte, sum_pxnet, sum_pxnnht, sum_pxbrut, sum_cout, nb_lines)
  SELECT
    bl.BLE_DATE,
    l.BLL_ARTID,
    mrk.MRK_ID,
    mrk.MRK_NOM,
    ray.RAY_ID,
    ray.RAY_NOM,
    gen.GRE_ID,
    gen.GRE_NOM,
    IF(bl.BLE_WEB = 1, 'WEB', 'BL'),
    SUM(l.BLL_QTE),
    SUM(l.BLL_PXNET),
    SUM(l.BLL_PXNN),
    SUM(l.BLL_PXBRUT),
    SUM(l.BLL_QTE * COALESCE(s.STC_PUMP, 0)),
    COUNT(*)
  FROM NEGBLL l
  JOIN NEGBL bl ON bl.BLE_ID = l.BLL_BLEID
  JOIN ARTARTICLE a ON a.ART_ID = l.BLL_ARTID
  LEFT JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
  LEFT JOIN ARTGENRE gen ON gen.GRE_ID = a.ART_GREID
  LEFT JOIN NKLSSFAMILLE ssf ON ssf.SSF_ID = a.ART_SSFID
  LEFT JOIN NKLFAMILLE fam ON fam.FAM_ID = ssf.SSF_FAMID
  LEFT JOIN NKLRAYON ray ON ray.RAY_ID = fam.FAM_RAYID
  LEFT JOIN AGRSTOCKCOUR s ON s.STC_ARTID = l.BLL_ARTID
    AND s.STC_TGFID = l.BLL_TGFID AND s.STC_COUID = l.BLL_COUID
  WHERE bl.BLE_DATE >= p_since_date
    AND bl.BLE_DATE IS NOT NULL
    AND l.BLL_ARTID > 0
  GROUP BY bl.BLE_DATE, l.BLL_ARTID, mrk.MRK_ID, mrk.MRK_NOM,
           ray.RAY_ID, ray.RAY_NOM, gen.GRE_ID, gen.GRE_NOM,
           IF(bl.BLE_WEB = 1, 'WEB', 'BL');

  -- REGULATIONS DE STOCK : depuis AGRMOUVEMENT (MVT_TYPE=6)
  INSERT INTO _ventes_daily
    (vente_date, art_id, mrk_id, mrk_nom, ray_id, ray_nom, gre_id, gre_nom,
     source, sum_qte, sum_pxnet, sum_pxnnht, sum_pxbrut, sum_cout, nb_lines)
  SELECT
    DATE(m.MVT_DATE),
    m.MVT_ARTID,
    mrk.MRK_ID,
    mrk.MRK_NOM,
    ray.RAY_ID,
    ray.RAY_NOM,
    gen.GRE_ID,
    gen.GRE_NOM,
    'REGUL',
    SUM(-m.MVT_QTE),
    SUM(-m.MVT_QTE * m.MVT_PXUNET),
    SUM(-m.MVT_QTE * m.MVT_PXUNET),
    SUM(-m.MVT_QTE * m.MVT_PXUBRUT),
    SUM(-m.MVT_QTE * COALESCE(s.STC_PUMP, 0)),
    COUNT(*)
  FROM AGRMOUVEMENT m
  JOIN ARTARTICLE a ON a.ART_ID = m.MVT_ARTID
  LEFT JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
  LEFT JOIN ARTGENRE gen ON gen.GRE_ID = a.ART_GREID
  LEFT JOIN NKLSSFAMILLE ssf ON ssf.SSF_ID = a.ART_SSFID
  LEFT JOIN NKLFAMILLE fam ON fam.FAM_ID = ssf.SSF_FAMID
  LEFT JOIN NKLRAYON ray ON ray.RAY_ID = fam.FAM_RAYID
  LEFT JOIN AGRSTOCKCOUR s ON s.STC_ARTID = m.MVT_ARTID
    AND s.STC_TGFID = m.MVT_TGFID AND s.STC_COUID = m.MVT_COUID
  WHERE DATE(m.MVT_DATE) >= p_since_date
    AND m.MVT_DATE IS NOT NULL
    AND m.MVT_TYPE = 6
  GROUP BY DATE(m.MVT_DATE), m.MVT_ARTID, mrk.MRK_ID, mrk.MRK_NOM,
           ray.RAY_ID, ray.RAY_NOM, gen.GRE_ID, gen.GRE_NOM;
END$$

DELIMITER ;
