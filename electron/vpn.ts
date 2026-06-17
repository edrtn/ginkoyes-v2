/**
 * Ginkoyes V2 — Embedded Tailscale VPN Manager
 *
 * macOS: Spawns tailscaled in userspace-networking mode with SOCKS5 proxy.
 * Windows: Detects the system Tailscale service (no daemon spawn needed).
 */

import { ChildProcess, spawn, execFileSync, execSync } from "child_process";
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

/** SOCKS5 proxy port (macOS only — Windows uses direct Tailscale routing) */
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
// Windows: detect system Tailscale service
// ============================================================

function isWindowsTailscaleRunning(): boolean {
  try {
    const out = execSync('tasklist /fi "imagename eq tailscaled.exe" /nh', {
      timeout: 5000,
    }).toString();
    return out.includes("tailscaled.exe");
  } catch {
    return false;
  }
}

function getWindowsTailscaleIp(): string | null {
  try {
    // Use the system tailscale CLI (in PATH or Program Files)
    const ip = execSync("tailscale ip -4", { timeout: 5000 }).toString().trim();
    return ip || null;
  } catch {
    // Try with our bundled CLI (talks to system service via default pipe)
    try {
      const ip = execFileSync(cliBin(), ["ip", "-4"], { timeout: 5000 }).toString().trim();
      return ip || null;
    } catch {
      return null;
    }
  }
}

// ============================================================
// Start / Stop / Status
// ============================================================

export async function startVpn(authKey: string): Promise<VpnStatus> {
  if (currentStatus.state === "connected" || currentStatus.state === "connecting") {
    return currentStatus;
  }

  // ── Windows: use system Tailscale service ──
  if (process.platform === "win32") {
    currentStatus = { state: "connecting", socksPort: SOCKS_PORT };

    if (!isWindowsTailscaleRunning()) {
      currentStatus = {
        state: "error",
        error: "Le service Tailscale n'est pas actif. Installez Tailscale ou demarrez le service.",
        socksPort: SOCKS_PORT,
      };
      return currentStatus;
    }

    const ip = getWindowsTailscaleIp();
    if (ip) {
      currentStatus = { state: "connected", ip, socksPort: SOCKS_PORT };
    } else {
      // Service running but not authenticated — try to bring up
      try {
        execSync(`tailscale up --auth-key=${authKey} --reset`, { timeout: 30000 });
        const newIp = getWindowsTailscaleIp();
        currentStatus = {
          state: newIp ? "connected" : "error",
          ip: newIp || undefined,
          error: newIp ? undefined : "Tailscale up mais pas d'IP attribuee",
          socksPort: SOCKS_PORT,
        };
      } catch (err) {
        currentStatus = {
          state: "error",
          error: `Tailscale up echoue: ${err instanceof Error ? err.message : String(err)}`,
          socksPort: SOCKS_PORT,
        };
      }
    }
    return currentStatus;
  }

  // ── macOS/Linux: spawn embedded tailscaled ──

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
    const args = [
      "--tun=userspace-networking",
      `--statedir=${stateDir}`,
      `--socks5-server=localhost:${SOCKS_PORT}`,
    ];

    const sock = getSocketPath();
    if (sock) args.push(`--socket=${sock}`);

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

    await new Promise((r) => setTimeout(r, 2000));

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
  // On Windows, don't stop the system service
  if (process.platform === "win32") {
    currentStatus = { state: "disconnected", socksPort: SOCKS_PORT };
    return;
  }
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
