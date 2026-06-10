-- ============================
-- Index composites couvrants pour les requetes restant sur tables brutes
-- ============================

-- CSHTICKET : count tickets par date (DASHBOARD_CA_TOTAL, NB_TICKETS)
CREATE INDEX IF NOT EXISTS idx_tke_date_total
  ON CSHTICKET (TKE_DATE, TKE_TOTALTTC);

-- CSHTICKETL : ventes par article (ARTICLE_VENTES, BRAND_VENTES)
CREATE INDEX IF NOT EXISTS idx_tkl_artid_tkeid
  ON CSHTICKETL (TKL_ARTID, TKL_TKEID);

-- CSHTICKETL : join ticket → lignes (deja idx sur TKL_TKEID dans 002)
-- NEGBLL : ventes par article (ARTICLE_VENTES)
CREATE INDEX IF NOT EXISTS idx_bll_artid_bleid
  ON NEGBLL (BLL_ARTID, BLL_BLEID);

-- NEGBL : filtre date pour BL (ACHAT_VENTES_DETAIL)
CREATE INDEX IF NOT EXISTS idx_ble_date_web
  ON NEGBL (BLE_DATE, BLE_WEB);

-- AGRSTOCKCOUR : stock par article + taille + couleur (join dans comparatif)
CREATE INDEX IF NOT EXISTS idx_stc_art_tgf_cou
  ON AGRSTOCKCOUR (STC_ARTID, STC_TGFID, STC_COUID, STC_QTE, STC_PUMP);

-- COMBCDEL : commandes par collection (ACHAT_TAUX_SORTIE, ACHAT_RECAP)
CREATE INDEX IF NOT EXISTS idx_cdl_cdeid_artid
  ON COMBCDEL (CDL_CDEID, CDL_ARTID);

-- RECBRL : receptions par article+couleur (ACHAT_TAUX_SORTIE)
CREATE INDEX IF NOT EXISTS idx_brl_breid_artid
  ON RECBRL (BRL_BREID, BRL_ARTID, BRL_COUID);

-- _ventes_daily : filtre marque+date pour achat comparatif
CREATE INDEX IF NOT EXISTS idx_vd_mrk_nom_date
  ON _ventes_daily (mrk_nom, vente_date, gre_nom);
