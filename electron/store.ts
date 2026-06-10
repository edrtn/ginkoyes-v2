import Store from "electron-store";

export interface DbConfig {
  lanHost: string;
  tailscaleHost: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface AppConfig {
  db: DbConfig;
}

const defaults: AppConfig = {
  db: {
    lanHost: "127.0.0.1",
    tailscaleHost: "",
    port: 3306,
    user: "ginkoyes",
    password: "ginkoyes",
    database: "ginkoyes",
  },
};

const store = new Store<AppConfig>({ defaults });

export default store;
