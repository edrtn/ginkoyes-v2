/**
 * Ginkoyes V2 — Embedded Tailscale VPN Manager
 *
 * Spawns a patched tailscaled in userspace-networking mode with SOCKS5 proxy.
 * Works without admin rights on both macOS and Windows.
 *
 * macOS: uses Unix socket for IPC
 * Windows: uses named pipe for IPC (patched SDDL + syspolicy bypass)
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

/** SOCKS5 proxy port used by the embedded tailscaled */
const SOCKS_PORT = 10055;

/** Named pipe path on Windows (no admin prefix) */
const WIN_PIPE_PATH = "\\\\.\\pipe\\SportLink-tailscaled";

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
  if (process.platform === "win32") return WIN_PIPE_PATH;
  return path.join(getStateDir(), "tailscaled.sock");
}

// ============================================================
// CLI helper — adds --socket flag for IPC
// ============================================================

function runCli(args: string[], timeoutMs: number = 30_000): string {
  const sock = getSocketPath();
  // --socket is a global flag and must come BEFORE the subcommand
  const fullArgs = [`--socket=${sock}`, ...args];
  return execFileSync(cliBin(), fullArgs, { timeout: timeoutMs }).toString().trim();
}

// ============================================================
// Start / Stop / Status
// ============================================================

export async function startVpn(authKey: string): Promise<VpnStatus> {
  if (currentStatus.state === "connected" || currentStatus.state === "connecting") {
    return currentStatus;
  }

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
    const stateDir = getStateDir();
    const sock = getSocketPath();

    const args = [
      "--tun=userspace-networking",
      `--statedir=${stateDir}`,
      `--socks5-server=localhost:${SOCKS_PORT}`,
      `--socket=${sock}`,
      "--no-logs-no-support",
      "--port=0",
    ];

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

    // Wait for daemon to start up
    await new Promise((r) => setTimeout(r, 3000));

    if (!daemon || daemon.killed) {
      throw new Error("tailscaled n'a pas demarre");
    }

    runCli(["up", `--auth-key=${authKey}`, "--reset"]);

    const ip = runCli(["ip", "-4"], 5000);

    currentStatus = { state: "connected", ip, socksPort: SOCKS_PORT };
    return currentStatus;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    currentStatus = { state: "error", error: msg, socksPort: SOCKS_PORT };
    stopVpn();
    return currentStatus;
  }
}

export function stopVpn(): void {
  if (daemon) {
    if (process.platform === "win32") {
      // On Windows, SIGTERM doesn't work well — use taskkill
      try {
        process.kill(daemon.pid!, "SIGTERM");
      } catch {
        // ignore
      }
    } else {
      daemon.kill("SIGTERM");
    }
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
