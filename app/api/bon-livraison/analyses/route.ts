import { NextRequest, NextResponse } from "next/server";
import { query, queryFirst } from "@/lib/db";
import { ensureBLTable } from "../init-table";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Paramètre id requis" },
        { status: 400 }
      );
    }

    await ensureBLTable();

    const row = await queryFirst<{
      id: number;
      file_name: string;
      supplier: string;
      brand: string;
      total_notes: number;
      total_articles: number;
      total_pieces: number;
      parsed_data: string;
      created_at: string;
    }>(
      `SELECT * FROM bl_analyses WHERE id = ?`,
      [id]
    );

    if (!row) {
      return NextResponse.json(
        { error: "Analyse introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...row,
      parsed_data: JSON.parse(row.parsed_data),
    });
  } catch (error) {
    console.error("Error fetching BL analysis:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Paramètre id requis" },
        { status: 400 }
      );
    }

    await ensureBLTable();
    await query(`DELETE FROM bl_analyses WHERE id = ?`, [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting BL analysis:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    );
  }
}
