CREATE TABLE IF NOT EXISTS _rapports_ia (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  marque        VARCHAR(100) NOT NULL,
  collection_id INT DEFAULT NULL,
  collection_nom VARCHAR(100) DEFAULT NULL,
  target_year   INT NOT NULL,
  from_n1       DATE NOT NULL,
  to_n1         DATE NOT NULL,
  from_n2       DATE NOT NULL,
  to_n2         DATE NOT NULL,
  contenu       LONGTEXT NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rapports_marque (marque),
  INDEX idx_rapports_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
