import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { RECENT_RECEPTIONS } from "@/lib/queries";

export async function GET() {
  try {
    const rows = await query(RECENT_RECEPTIONS);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching receptions:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement des réceptions" },
      { status: 500 }
    );
  }
}
