import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ensureBLTable } from "../init-table";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, parsedData } = body;

    if (!fileName || !parsedData?.deliveryNotes) {
      return NextResponse.json(
        { error: "Données manquantes" },
        { status: 400 }
      );
    }

    await ensureBLTable();

    const notes = parsedData.deliveryNotes;
    const supplier = notes[0]?.supplier || "";
    const brand = notes[0]?.brand || "";
    const totalNotes = notes.length;
    const totalArticles = notes.reduce(
      (s: number, n: { articles: unknown[] }) => s + n.articles.length,
      0
    );
    const totalPieces = notes.reduce(
      (s: number, n: { totalPieces: number }) => s + n.totalPieces,
      0
    );

    const result = await query<{ insertId: number }>(
      `INSERT INTO bl_analyses (file_name, supplier, brand, total_notes, total_articles, total_pieces, parsed_data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        fileName,
        supplier,
        brand,
        totalNotes,
        totalArticles,
        totalPieces,
        JSON.stringify(parsedData),
      ]
    );

    // mysql2 returns ResultSetHeader with insertId
    const insertId = (result as unknown as { insertId: number }).insertId;

    return NextResponse.json({ id: insertId, success: true });
  } catch (error) {
    console.error("Error saving BL analysis:", error);
    return NextResponse.json(
      { error: "Erreur lors de la sauvegarde" },
      { status: 500 }
    );
  }
}
