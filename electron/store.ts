import Store from "electron-store";

export interface DbConfig {
  lanHost: string;
  tailscaleHost: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface VpnConfig {
  authKey: string;
  enabled: boolean;
}

export interface AppConfig {
  db: DbConfig;
  vpn: VpnConfig;
  configured: boolean;
}

const defaults: AppConfig = {
  db: {
    lanHost: "",
    tailscaleHost: "",
    port: 3306,
    user: "ginkoyes",
    password: "ginkoyes",
    database: "ginkoyes",
  },
  vpn: {
    authKey: "",
    enabled: false,
  },
  configured: false,
};

const store = new Store<AppConfig>({ defaults });

export default store;
