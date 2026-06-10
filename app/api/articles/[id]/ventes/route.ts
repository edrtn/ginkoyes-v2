import { NextRequest, NextResponse } from "next/server";
import { query, queryFirst } from "@/lib/db";
import { ARTICLE_VENTES, ARTICLE_DETAIL } from "@/lib/queries";

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

    // Get article to extract base ref for web article matching
    const article = await queryFirst<{ ART_REFMRK: string }>(
      ARTICLE_DETAIL,
      [artId]
    );
    // Base ref = first part before space or hyphen (e.g. "1171904 FYZ" → "1171904")
    const baseRef = article?.ART_REFMRK?.trim().split(/[\s-]/)[0] || "";

    const rows = await query(ARTICLE_VENTES, [artId, baseRef]);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching ventes:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement des ventes" },
      { status: 500 }
    );
  }
}
