/**
 * Ginkoyes V2 — L2TP/IPsec VPN Manager
 *
 * Uses OS-native L2TP/IPsec VPN (Livebox) instead of Tailscale.
 * Once connected, the client is on the LAN (192.168.1.x)
 * and can reach MariaDB directly — no SOCKS5 / tunnel needed.
 *
 * Windows: PowerShell Add-VpnConnection + rasdial
 * macOS: .mobileconfig profile + scutil --nc
 */

import { exec as execCb } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { randomUUID } from "crypto";

const execAsync = promisify(execCb);

// ============================================================
// Types
// ============================================================

export type VpnState = "disconnected" | "connecting" | "connected" | "error";

export interface VpnStatus {
  state: VpnState;
  error?: string;
}

export interface L2tpConfig {
  serverAddress: string;
  username: string;
  password: string;
  presharedKey: string;
}

// ============================================================
// Constants
// ============================================================

const VPN_NAME = "SportLink VPN";
const LAN_PREFIX = "192.168.1.0/24";

/** Polling interval when connecting (ms) */
const POLL_CONNECTING_MS = 3000;
/** Polling interval when connected (ms) */
const POLL_CONNECTED_MS = 30000;
/** Max attempts when polling for connection */
const MAX_CONNECT_ATTEMPTS = 40; // 40 × 3s = 2 minutes

// ============================================================
// State
// ============================================================

let currentStatus: VpnStatus = { state: "disconnected" };
let pollTimer: ReturnType<typeof setTimeout> | null = null;

// ============================================================
// Platform-specific helpers
// ============================================================

async function runPowershell(cmd: string): Promise<string> {
  const { stdout } = await execAsync(
    `powershell -NoProfile -NonInteractive -Command "${cmd.replace(/"/g, '\\"')}"`,
    { timeout: 30000 }
  );
  return stdout.trim();
}

async function runShell(cmd: string): Promise<string> {
  const { stdout } = await execAsync(cmd, { timeout: 30000 });
  return stdout.trim();
}

// ============================================================
// Windows L2TP
// ============================================================

async function windowsEnsureProfile(config: L2tpConfig): Promise<void> {
  // Check if profile already exists
  try {
    const existing = await runPowershell(
      `(Get-VpnConnection -Name '${VPN_NAME}' -ErrorAction SilentlyContinue).Name`
    );
    if (existing === VPN_NAME) {
      // Update PSK and server if needed
      await runPowershell(
        `Set-VpnConnection -Name '${VPN_NAME}' -ServerAddress '${config.serverAddress}' -L2tpPsk '${config.presharedKey}' -Force`
      );
      return;
    }
  } catch {
    // Profile doesn't exist — create it
  }

  await runPowershell(
    `Add-VpnConnection -Name '${VPN_NAME}' ` +
    `-ServerAddress '${config.serverAddress}' ` +
    `-TunnelType L2tp ` +
    `-L2tpPsk '${config.presharedKey}' ` +
    `-AuthenticationMethod MSChapv2 ` +
    `-EncryptionLevel Optional ` +
    `-Force`
  );

  // Add split tunnel route so only LAN traffic goes through VPN
  try {
    await runPowershell(
      `Add-VpnConnectionRoute -ConnectionName '${VPN_NAME}' -DestinationPrefix '${LAN_PREFIX}'`
    );
    // Enable split tunneling
    await runPowershell(
      `Set-VpnConnection -Name '${VPN_NAME}' -SplitTunneling $true -Force`
    );
  } catch {
    // Route may already exist
  }
}

async function windowsConnect(config: L2tpConfig): Promise<void> {
  await execAsync(
    `rasdial "${VPN_NAME}" "${config.username}" "${config.password}"`,
    { timeout: 30000 }
  );
}

async function windowsDisconnect(): Promise<void> {
  try {
    await execAsync(`rasdial "${VPN_NAME}" /disconnect`, { timeout: 10000 });
  } catch {
    // May not be connected
  }
}

async function windowsGetStatus(): Promise<VpnState> {
  try {
    const status = await runPowershell(
      `(Get-VpnConnection -Name '${VPN_NAME}' -ErrorAction SilentlyContinue).ConnectionStatus`
    );
    if (status === "Connected") return "connected";
    if (status === "Connecting") return "connecting";
    return "disconnected";
  } catch {
    return "disconnected";
  }
}

// ============================================================
// macOS L2TP — via .mobileconfig profile + scutil --nc
// ============================================================

/**
 * Escape XML special characters for .mobileconfig plist values.
 */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Generate a .mobileconfig (Configuration Profile) for L2TP/IPsec VPN.
 * Once installed via System Settings, the VPN can be managed with scutil --nc.
 */
function generateMobileConfig(config: L2tpConfig): string {
  const payloadUUID = randomUUID().toUpperCase();
  const vpnPayloadUUID = randomUUID().toUpperCase();

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadType</key>
      <string>com.apple.vpn.managed</string>
      <key>PayloadIdentifier</key>
      <string>com.sportlink.vpn.l2tp</string>
      <key>PayloadUUID</key>
      <string>${vpnPayloadUUID}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>PayloadDisplayName</key>
      <string>VPN (L2TP)</string>
      <key>UserDefinedName</key>
      <string>${xmlEscape(VPN_NAME)}</string>
      <key>VPNType</key>
      <string>L2TP</string>
      <key>PPP</key>
      <dict>
        <key>AuthName</key>
        <string>${xmlEscape(config.username)}</string>
        <key>AuthPassword</key>
        <string>${xmlEscape(config.password)}</string>
        <key>CommRemoteAddress</key>
        <string>${xmlEscape(config.serverAddress)}</string>
      </dict>
      <key>IPSec</key>
      <dict>
        <key>AuthenticationMethod</key>
        <string>SharedSecret</string>
        <key>SharedSecret</key>
        <string>${xmlEscape(config.presharedKey)}</string>
      </dict>
    </dict>
  </array>
  <key>PayloadDisplayName</key>
  <string>${xmlEscape(VPN_NAME)}</string>
  <key>PayloadIdentifier</key>
  <string>com.sportlink.vpn</string>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${payloadUUID}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
  <key>PayloadRemovalDisallowed</key>
  <false/>
</dict>
</plist>`;
}

/**
 * Check if a VPN service with our name exists via scutil --nc list.
 */
async function macVpnExists(): Promise<boolean> {
  try {
    const output = await runShell(`scutil --nc list`);
    return output.includes(`"${VPN_NAME}"`);
  } catch {
    return false;
  }
}

async function macEnsureProfile(config: L2tpConfig): Promise<void> {
  if (await macVpnExists()) {
    console.log("[VPN] macOS: VPN profile already installed");
    return;
  }

  // Generate .mobileconfig and open it for user installation
  const profilePath = path.join(app.getPath("userData"), "SportLink-VPN.mobileconfig");
  fs.writeFileSync(profilePath, generateMobileConfig(config), "utf-8");
  console.log("[VPN] macOS: Generated mobileconfig at", profilePath);

  await runShell(`open "${profilePath}"`);

  throw new Error(
    "Profil VPN cree. Installez-le dans Reglages Systeme > " +
    "Confidentialite et securite > Profils, puis relancez le VPN."
  );
}

async function macConnect(_config: L2tpConfig): Promise<void> {
  await runShell(`scutil --nc start '${VPN_NAME}'`);
}

async function macDisconnect(): Promise<void> {
  try {
    await runShell(`scutil --nc stop '${VPN_NAME}'`);
  } catch {
    // May not be connected
  }
}

async function macGetStatus(): Promise<VpnState> {
  try {
    const output = await runShell(`scutil --nc status '${VPN_NAME}'`);
    const firstLine = output.split("\n")[0].trim().toLowerCase();
    if (firstLine === "connected") return "connected";
    if (firstLine === "connecting" || firstLine === "authenticating") return "connecting";
    return "disconnected";
  } catch {
    return "disconnected";
  }
}

// ============================================================
// Cross-platform API
// ============================================================

async function ensureProfile(config: L2tpConfig): Promise<void> {
  if (process.platform === "win32") {
    await windowsEnsureProfile(config);
  } else if (process.platform === "darwin") {
    await macEnsureProfile(config);
  } else {
    throw new Error("VPN L2TP non supporte sur cette plateforme");
  }
}

async function connectVpn(config: L2tpConfig): Promise<void> {
  if (process.platform === "win32") {
    await windowsConnect(config);
  } else if (process.platform === "darwin") {
    await macConnect(config);
  }
}

async function disconnectVpn(): Promise<void> {
  if (process.platform === "win32") {
    await windowsDisconnect();
  } else if (process.platform === "darwin") {
    await macDisconnect();
  }
}

async function queryOsStatus(): Promise<VpnState> {
  if (process.platform === "win32") {
    return windowsGetStatus();
  } else if (process.platform === "darwin") {
    return macGetStatus();
  }
  return "disconnected";
}

// ============================================================
// Status polling
// ============================================================

function stopPolling(): void {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function startPolling(): void {
  stopPolling();

  let attempt = 0;

  const poll = async () => {
    try {
      const osState = await queryOsStatus();

      if (osState === "connected") {
        currentStatus = { state: "connected" };
        // Continue polling at slow rate to detect disconnection
        pollTimer = setTimeout(poll, POLL_CONNECTED_MS);
        return;
      }

      if (currentStatus.state === "connecting") {
        attempt++;
        if (attempt >= MAX_CONNECT_ATTEMPTS) {
          currentStatus = {
            state: "error",
            error: "VPN: timeout en attente de connexion",
          };
          return;
        }
        // Keep polling at fast rate
        pollTimer = setTimeout(poll, POLL_CONNECTING_MS);
        return;
      }

      // OS says disconnected and we weren't connecting
      if (currentStatus.state === "connected") {
        // Was connected, now disconnected — update state
        currentStatus = { state: "disconnected" };
      }
      // Slow poll to detect external connections
      pollTimer = setTimeout(poll, POLL_CONNECTED_MS);
    } catch {
      pollTimer = setTimeout(poll, POLL_CONNECTED_MS);
    }
  };

  pollTimer = setTimeout(poll, POLL_CONNECTING_MS);
}

// ============================================================
// Public API
// ============================================================

export async function startVpn(config: L2tpConfig): Promise<VpnStatus> {
  if (currentStatus.state === "connected" || currentStatus.state === "connecting") {
    return currentStatus;
  }

  currentStatus = { state: "connecting" };

  try {
    console.log("[VPN] Ensuring L2TP profile...");
    await ensureProfile(config);

    console.log("[VPN] Connecting...");
    await connectVpn(config);

    // Start polling for connection status
    startPolling();

    return currentStatus;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[VPN] Start error:", msg);
    currentStatus = { state: "error", error: msg };
    return currentStatus;
  }
}

export async function stopVpn(): Promise<void> {
  stopPolling();
  try {
    await disconnectVpn();
  } catch (err) {
    console.error("[VPN] Stop error:", err instanceof Error ? err.message : String(err));
  }
  currentStatus = { state: "disconnected" };
}

export function getVpnStatus(): VpnStatus {
  return { ...currentStatus };
}
