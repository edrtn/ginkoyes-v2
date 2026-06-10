-- ============================
-- Table resumee _ventes_daily
-- Pre-agregation des ventes par (date, article, marque, rayon, genre, source)
-- avec noms denormalises pour 0 join au query time
-- ============================

CREATE TABLE IF NOT EXISTS _ventes_daily (
  vente_date   DATE         NOT NULL,
  art_id       INT          NOT NULL,
  mrk_id       INT          DEFAULT NULL,
  mrk_nom      VARCHAR(100) DEFAULT NULL,
  ray_id       INT          DEFAULT NULL,
  ray_nom      VARCHAR(100) DEFAULT NULL,
  gre_id       INT          DEFAULT NULL,
  gre_nom      VARCHAR(50)  DEFAULT NULL,
  source       ENUM('CAISSE','WEB','BL') NOT NULL DEFAULT 'CAISSE',
  sum_qte      DECIMAL(15,2) NOT NULL DEFAULT 0,
  sum_pxnet    DECIMAL(15,2) NOT NULL DEFAULT 0,
  sum_pxnnht   DECIMAL(15,2) NOT NULL DEFAULT 0,
  sum_pxbrut   DECIMAL(15,2) NOT NULL DEFAULT 0,
  nb_lines     INT           NOT NULL DEFAULT 0,

  PRIMARY KEY (vente_date, art_id, source),

  -- Index couvrants pour les requetes dashboard
  INDEX idx_vd_date_ray    (vente_date, ray_nom, sum_pxnet),
  INDEX idx_vd_date_mrk    (vente_date, mrk_nom, sum_pxnet),
  INDEX idx_vd_date_month  (vente_date, sum_pxnet),
  INDEX idx_vd_mrk_date    (mrk_nom, vente_date),
  INDEX idx_vd_art_date    (art_id, vente_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
