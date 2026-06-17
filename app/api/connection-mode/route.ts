import { NextResponse } from "next/server";
import { getConnectionMode, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await query("SELECT 1");
  } catch {
    // connectionMode is set to "error" by query() on failure
  }
  return NextResponse.json({ mode: getConnectionMode() });
}
