/**
 * Ginkoyes V2 — TCP tunnel through SOCKS5
 *
 * Creates a local TCP server (port 13306) that proxies every
 * incoming connection through Tailscale's SOCKS5 proxy to the
 * remote MariaDB server. mysql2 connects to localhost:13306
 * as if it were a normal MariaDB endpoint.
 */

import net from "net";
import { SocksClient } from "socks";

// ============================================================
// Constants
// ============================================================

/** Fixed local port — mysql2 connects here */
export const TUNNEL_PORT = 13306;

// ============================================================
// State
// ============================================================

let server: net.Server | null = null;
let targetHost = "";
let targetPort = 3306;
let socksProxyPort = 10055;

// ============================================================
// Start / Stop
// ============================================================

export function startTunnel(
  remoteHost: string,
  remotePort: number,
  socksPort: number
): Promise<number> {
  targetHost = remoteHost;
  targetPort = remotePort;
  socksProxyPort = socksPort;

  return new Promise((resolve, reject) => {
    server = net.createServer((client) => {
      SocksClient.createConnection({
        proxy: { host: "127.0.0.1", port: socksProxyPort, type: 5 },
        command: "connect",
        destination: { host: targetHost, port: targetPort },
      })
        .then(({ socket: proxy }) => {
          client.pipe(proxy);
          proxy.pipe(client);
          client.on("error", () => proxy.destroy());
          proxy.on("error", () => client.destroy());
          client.on("close", () => proxy.destroy());
          proxy.on("close", () => client.destroy());
        })
        .catch(() => {
          client.destroy();
        });
    });

    server.on("error", reject);

    server.listen(TUNNEL_PORT, "127.0.0.1", () => {
      resolve(TUNNEL_PORT);
    });
  });
}

export function stopTunnel(): void {
  if (server) {
    server.close();
    server = null;
  }
}

export function isTunnelRunning(): boolean {
  return server !== null && server.listening;
}
