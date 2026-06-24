-- ============================================================
-- Ginkoyes V2 — Migration VPN config : L2TP → SSH Tunnel
--
-- Remplace les colonnes L2TP par les colonnes SSH tunnel.
-- ============================================================

-- Drop old columns (L2TP/IPsec)
ALTER TABLE _vpn_config
  DROP COLUMN IF EXISTS server_address,
  DROP COLUMN IF EXISTS vpn_username,
  DROP COLUMN IF EXISTS vpn_password,
  DROP COLUMN IF EXISTS preshared_key;

-- Add new columns (SSH tunnel)
ALTER TABLE _vpn_config
  ADD COLUMN IF NOT EXISTS vps_host    VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS vps_port    INT NOT NULL DEFAULT 22,
  ADD COLUMN IF NOT EXISTS ssh_user    VARCHAR(100) NOT NULL DEFAULT 'tunnel',
  ADD COLUMN IF NOT EXISTS private_key TEXT,
  ADD COLUMN IF NOT EXISTS remote_port INT NOT NULL DEFAULT 3307;
