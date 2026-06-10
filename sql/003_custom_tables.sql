-- ============================================================
-- Ginkoyes V2 — Tables custom (non Ginkoia)
-- ============================================================

USE ginkoyes;

-- ============================================================
-- Métadonnées de synchronisation
-- ============================================================

CREATE TABLE IF NOT EXISTS _sync_meta (
  id           INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sync_start   DATETIME     NOT NULL,
  sync_end     DATETIME     DEFAULT NULL,
  status       ENUM('running', 'success', 'error') NOT NULL DEFAULT 'running',
  tables_synced INT         DEFAULT 0,
  rows_synced  INT          DEFAULT 0,
  error_message TEXT        DEFAULT NULL,
  duration_ms  INT          DEFAULT NULL
) ENGINE=InnoDB;

-- ============================================================
-- Paramètres applicatifs (sauvegardés côté serveur MariaDB)
-- ============================================================

CREATE TABLE IF NOT EXISTS _app_settings (
  setting_key   VARCHAR(100) NOT NULL PRIMARY KEY,
  setting_value TEXT         DEFAULT NULL,
  updated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
