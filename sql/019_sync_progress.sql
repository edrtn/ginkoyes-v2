-- ============================
-- Table _sync_progress
-- Tracks the last synced ID per table for incremental sync
-- ============================

CREATE TABLE IF NOT EXISTS _sync_progress (
  table_name   VARCHAR(64)   NOT NULL PRIMARY KEY,
  id_column    VARCHAR(64)   NOT NULL,
  last_max_id  BIGINT        NOT NULL DEFAULT 0,
  last_sync_at DATETIME      DEFAULT NULL,
  rows_synced  BIGINT        NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed initial rows for all incremental tables
-- (last_max_id = 0 means first incremental run will fetch everything)
INSERT IGNORE INTO _sync_progress (table_name, id_column, last_max_id) VALUES
  ('CSHTICKET',   'TKE_ID', 0),
  ('CSHTICKETL',  'TKL_ID', 0),
  ('NEGBL',       'BLE_ID', 0),
  ('NEGBLL',      'BLL_ID', 0),
  ('COMBCDE',     'CDE_ID', 0),
  ('COMBCDEL',    'CDL_ID', 0),
  ('RECBR',       'BRE_ID', 0),
  ('RECBRL',      'BRL_ID', 0),
  ('NEGRETOUR',   'RTE_ID', 0),
  ('NEGRETOURL',  'RTL_ID', 0),
  ('AGRMOUVEMENT','MVT_ID', 0),
  ('SAVMAT',      'MAT_ID', 0),
  ('SAVFICHEL',   'SAL_ID', 0),
  ('SAVFICHEART', 'SAA_ID', 0),
  ('SAVMATDETAIL','MAD_ID', 0),
  ('SAVHISTO',    'SAH_ID', 0),
  ('SAVFICHEPC',  'SPC_ID', 0);
