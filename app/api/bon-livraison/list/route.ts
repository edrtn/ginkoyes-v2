import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ensureBLTable } from "../init-table";

export async function GET() {
  try {
    await ensureBLTable();

    const rows = await query<{
      id: number;
      file_name: string;
      supplier: string;
      brand: string;
      total_notes: number;
      total_articles: number;
      total_pieces: number;
      created_at: string;
    }>(
      `SELECT id, file_name, supplier, brand, total_notes, total_articles, total_pieces, created_at
       FROM bl_analyses
       ORDER BY created_at DESC
       LIMIT 50`
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error listing BL analyses:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement" },
      { status: 500 }
    );
  }
}
