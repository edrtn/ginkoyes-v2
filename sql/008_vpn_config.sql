-- ============================================================
-- Ginkoyes V2 — Table de configuration VPN
--
-- Table single-row contenant les credentials Tailscale.
-- Ecrite par le setup.ps1 (serveur), lue par le client Electron
-- en LAN pour auto-configurer le VPN embarque.
-- ============================================================

CREATE TABLE IF NOT EXISTS _vpn_config (
  id            INT          NOT NULL DEFAULT 1,
  tailscale_ip  VARCHAR(45)  NOT NULL COMMENT 'IP Tailscale du serveur (ex: 100.64.x.x)',
  auth_key      VARCHAR(255) NOT NULL COMMENT 'Auth key pre-provisionnee pour les clients',
  tailnet_name  VARCHAR(100) NOT NULL DEFAULT '' COMMENT 'Nom du reseau Tailscale (informatif)',
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
