import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ARTICLE_RECEPTIONS } from "@/lib/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const artId = parseInt(id, 10);
    if (isNaN(artId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const rows = await query(ARTICLE_RECEPTIONS, [artId]);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching receptions:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement des réceptions" },
      { status: 500 }
    );
  }
}
