import { NextResponse } from "next/server";
import { queryFirst } from "@/lib/db";

export const dynamic = "force-dynamic";

interface TunnelRow {
  vps_host: string;
  vps_port: number;
  ssh_user: string;
  private_key: string | null;
  remote_port: number;
}

export async function GET() {
  try {
    const row = await queryFirst<TunnelRow>(
      "SELECT vps_host, vps_port, ssh_user, private_key, remote_port FROM _vpn_config WHERE id = 1"
    );

    if (!row || !row.vps_host) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      vpsHost: row.vps_host,
      vpsPort: row.vps_port,
      sshUser: row.ssh_user,
      privateKey: row.private_key,
      remotePort: row.remote_port,
    });
  } catch {
    return NextResponse.json(null);
  }
}
