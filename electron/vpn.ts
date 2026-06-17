/**
 * Ginkoyes V2 — Embedded Tailscale VPN Manager
 *
 * Manages a Tailscale daemon running in userspace-networking mode.
 * No admin rights needed. Creates a SOCKS5 proxy on localhost
 * that the tunnel module uses to reach the server's MariaDB.
 */

import { ChildProcess, spawn, execFileSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { app } from "electron";

// ============================================================
// Types
// ============================================================

export type VpnState = "disconnected" | "connecting" | "connected" | "error";

export interface VpnStatus {
  state: VpnState;
  ip?: string;
  error?: string;
  socksPort: number;
}

// ============================================================
// Constants
// ============================================================

/** SOCKS5 proxy port (non-default to avoid conflicts with system Tailscale) */
const SOCKS_PORT = 10055;

// ============================================================
// State
// ============================================================

let daemon: ChildProcess | null = null;
let currentStatus: VpnStatus = { state: "disconnected", socksPort: SOCKS_PORT };

// ============================================================
// Binary paths
// ============================================================

function getBinDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "tailscale");
  }
  // Dev mode: expect binaries in tailscale-bin/<platform>/
  const platform =
    process.platform === "win32"
      ? "win"
      : process.platform === "darwin"
        ? "darwin"
        : "linux";
  return path.join(app.getAppPath(), "tailscale-bin", platform);
}

function daemonBin(): string {
  const ext = process.platform === "win32" ? ".exe" : "";
  return path.join(getBinDir(), `tailscaled${ext}`);
}

function cliBin(): string {
  const ext = process.platform === "win32" ? ".exe" : "";
  return path.join(getBinDir(), `tailscale${ext}`);
}

// ============================================================
// State directory (per-user, per-app)
// ============================================================

function getStateDir(): string {
  const dir = path.join(app.getPath("userData"), "tailscale");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getSocketPath(): string {
  // Windows uses named pipes, no custom socket needed
  if (process.platform === "win32") return "";
  return path.join(getStateDir(), "tailscaled.sock");
}

// ============================================================
// CLI helper — adds --socket flag on Unix
// ============================================================

function runCli(args: string[], timeoutMs: number = 30_000): string {
  const sock = getSocketPath();
  // --socket is a global flag and must come BEFORE the subcommand
  const fullArgs = sock ? [`--socket=${sock}`, ...args] : args;
  return execFileSync(cliBin(), fullArgs, { timeout: timeoutMs }).toString().trim();
}

// ============================================================
// Start / Stop / Status
// ============================================================

export async function startVpn(authKey: string): Promise<VpnStatus> {
  if (currentStatus.state === "connected" || currentStatus.state === "connecting") {
    return currentStatus;
  }

  // Check that binaries exist
  if (!fs.existsSync(daemonBin())) {
    currentStatus = {
      state: "error",
      error: `Binaire Tailscale introuvable : ${daemonBin()}`,
      socksPort: SOCKS_PORT,
    };
    return currentStatus;
  }

  currentStatus = { state: "connecting", socksPort: SOCKS_PORT };

  try {
    // Build tailscaled args
    const stateDir = getStateDir();
    const args = [
      "--tun=userspace-networking",
      `--statedir=${stateDir}`,
      `--socks5-server=localhost:${SOCKS_PORT}`,
    ];

    const sock = getSocketPath();
    if (sock) args.push(`--socket=${sock}`);

    // Spawn daemon
    daemon = spawn(daemonBin(), args, { stdio: "pipe" });

    daemon.on("exit", (code) => {
      if (currentStatus.state === "connected" || currentStatus.state === "connecting") {
        currentStatus = {
          state: "error",
          error: `tailscaled a quitte avec le code ${code}`,
          socksPort: SOCKS_PORT,
        };
      }
      daemon = null;
    });

    // Wait for daemon to initialize
    await new Promise((r) => setTimeout(r, 2000));

    if (!daemon || daemon.killed) {
      throw new Error("tailscaled n'a pas demarre");
    }

    // Authenticate
    runCli(["up", `--auth-key=${authKey}`, "--reset"]);

    // Retrieve our Tailscale IP
    const ip = runCli(["ip", "-4"], 5000);

    currentStatus = { state: "connected", ip, socksPort: SOCKS_PORT };
    return currentStatus;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    currentStatus = { state: "error", error: msg, socksPort: SOCKS_PORT };
    // Clean up failed daemon
    stopVpn();
    return currentStatus;
  }
}

export function stopVpn(): void {
  if (daemon) {
    daemon.kill("SIGTERM");
    daemon = null;
  }
  currentStatus = { state: "disconnected", socksPort: SOCKS_PORT };
}

export function getVpnStatus(): VpnStatus {
  return { ...currentStatus };
}

export function getSocksPort(): number {
  return SOCKS_PORT;
}
