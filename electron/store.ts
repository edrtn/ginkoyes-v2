import Store from "electron-store";

export interface DbConfig {
  lanHost: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface SshConfig {
  vpsHost: string;
  vpsPort: number;
  sshUser: string;
  privateKey: string;
  remotePort: number;   // port on VPS (reverse tunnel), default 3307
  enabled: boolean;
}

export interface AppConfig {
  db: DbConfig;
  ssh: SshConfig;
  configured: boolean;
}

const defaults: AppConfig = {
  db: {
    lanHost: "",
    port: 3306,
    user: "ginkoyes",
    password: "ginkoyes",
    database: "ginkoyes",
  },
  ssh: {
    vpsHost: "85.215.176.58",
    vpsPort: 22,
    sshUser: "tunnel",
    privateKey: "",
    remotePort: 3307,
    enabled: false,
  },
  configured: false,
};

const store = new Store<AppConfig>({
  defaults,
  migrations: {
    ">=1.7.0": (s) => {
      // Clean up old Tailscale fields
      const vpn = s.get("vpn") as Record<string, unknown> | undefined;
      if (vpn && "authKey" in vpn) {
        s.delete("vpn" as keyof AppConfig);
      }
      // Clean up old tailscaleHost from db config
      const db = s.get("db") as Record<string, unknown>;
      if ("tailscaleHost" in db) {
        const { tailscaleHost: _, ...cleanDb } = db;
        s.set("db", cleanDb as DbConfig);
      }
    },
    ">=1.8.0": (s) => {
      // Migrate old L2TP VPN config to SSH config
      const vpn = s.get("vpn") as Record<string, unknown> | undefined;
      if (vpn) {
        s.delete("vpn" as keyof AppConfig);
      }
      // Initialize SSH config if not present
      const ssh = s.get("ssh") as Record<string, unknown> | undefined;
      if (!ssh || !("vpsHost" in ssh)) {
        s.set("ssh", defaults.ssh);
      }
    },
  },
});

export default store;
