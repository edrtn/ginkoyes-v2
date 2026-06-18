/**
 * SSH Tunnel Manager — connects to VPS relay via ssh2
 *
 * Creates a local TCP server that forwards connections through
 * an SSH tunnel to VPS:localhost:3307 (reverse-tunneled to MariaDB).
 *
 * Flow: App → localhost:localPort → SSH → VPS:localhost:3307 → magasin:3306
 */

import { Client } from "ssh2";
import net from "net";

export type TunnelState = "disconnected" | "connecting" | "connected" | "error";

export interface TunnelStatus {
  state: TunnelState;
  localPort?: number;
  error?: string;
}

export interface SshTunnelConfig {
  vpsHost: string;
  vpsPort: number;
  sshUser: string;
  privateKey: string;
  remoteHost: string; // usually "localhost"
  remotePort: number; // usually 3307
}

let sshClient: Client | null = null;
let localServer: net.Server | null = null;
let localPort = 0;
let currentStatus: TunnelStatus = { state: "disconnected" };
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentConfig: SshTunnelConfig | null = null;
let forwardErrors = 0;

function cleanup() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (localServer) {
    try { localServer.close(); } catch { /* ignore */ }
    localServer = null;
  }
  if (sshClient) {
    try { sshClient.destroy(); } catch { /* ignore */ }
    sshClient = null;
  }
  localPort = 0;
  forwardErrors = 0;
}

function triggerReconnect() {
  if (currentStatus.state === "connecting") return;
  console.log("[SSH-Tunnel] Triggering reconnect...");
  currentStatus = { state: "disconnected" };
  cleanup();
  scheduleReconnect();
}

function scheduleReconnect() {
  if (reconnectTimer || !currentConfig) return;
  console.log("[SSH-Tunnel] Reconnecting in 5s...");
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (currentConfig && currentStatus.state !== "connected" && currentStatus.state !== "connecting") {
      startTunnel(currentConfig).catch((err) => {
        console.error("[SSH-Tunnel] Reconnect failed:", err.message);
      });
    }
  }, 5000);
}

export function startTunnel(config: SshTunnelConfig): Promise<TunnelStatus> {
  return new Promise((resolve) => {
    if (currentStatus.state === "connected" || currentStatus.state === "connecting") {
      resolve(currentStatus);
      return;
    }

    cleanup();
    currentConfig = config;
    currentStatus = { state: "connecting" };

    const client = new Client();
    sshClient = client;

    client.on("ready", () => {
      console.log("[SSH-Tunnel] SSH connection established");

      // Create local TCP server to forward connections
      const server = net.createServer((socket) => {
        if (!sshClient) {
          socket.destroy();
          return;
        }
        client.forwardOut(
          "127.0.0.1",
          0,
          config.remoteHost || "localhost",
          config.remotePort || 3307,
          (err, stream) => {
            if (err) {
              console.error("[SSH-Tunnel] Forward error:", err.message);
              socket.end();
              forwardErrors++;
              // If multiple forward errors, SSH is likely dead — reconnect
              if (forwardErrors >= 2) {
                console.log("[SSH-Tunnel] Too many forward errors, reconnecting...");
                triggerReconnect();
              }
              return;
            }
            forwardErrors = 0; // reset on success
            socket.pipe(stream).pipe(socket);
            stream.on("error", () => socket.destroy());
            socket.on("error", () => stream.destroy());
          }
        );
      });

      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as net.AddressInfo;
        localPort = addr.port;
        localServer = server;
        currentStatus = { state: "connected", localPort };
        console.log(`[SSH-Tunnel] Tunnel active on 127.0.0.1:${localPort} → ${config.vpsHost}:${config.remotePort}`);
        resolve(currentStatus);
      });

      server.on("error", (err) => {
        console.error("[SSH-Tunnel] Local server error:", err.message);
        currentStatus = { state: "error", error: `Serveur local: ${err.message}` };
        cleanup();
        scheduleReconnect();
      });
    });

    client.on("error", (err) => {
      console.error("[SSH-Tunnel] SSH error:", err.message);
      currentStatus = { state: "error", error: err.message };
      cleanup();
      scheduleReconnect();
      resolve(currentStatus);
    });

    client.on("close", () => {
      if (currentStatus.state === "connected" || currentStatus.state === "connecting") {
        console.log("[SSH-Tunnel] Connection closed");
        currentStatus = { state: "disconnected" };
        cleanup();
        scheduleReconnect();
      }
    });

    client.on("end", () => {
      if (currentStatus.state === "connected") {
        console.log("[SSH-Tunnel] SSH ended");
        triggerReconnect();
      }
    });

    try {
      client.connect({
        host: config.vpsHost,
        port: config.vpsPort || 22,
        username: config.sshUser || "tunnel",
        privateKey: config.privateKey,
        keepaliveInterval: 10000,  // 10s — detect dead connection faster
        keepaliveCountMax: 3,      // 3 × 10s = 30s max to detect
        readyTimeout: 15000,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[SSH-Tunnel] Connect error:", msg);
      currentStatus = { state: "error", error: msg };
      resolve(currentStatus);
    }
  });
}

export function stopTunnel(): void {
  currentConfig = null;
  cleanup();
  currentStatus = { state: "disconnected" };
  console.log("[SSH-Tunnel] Tunnel stopped");
}

export function getTunnelStatus(): TunnelStatus {
  return { ...currentStatus };
}

export function getTunnelPort(): number {
  return localPort;
}
