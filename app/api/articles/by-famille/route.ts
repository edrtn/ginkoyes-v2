import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ARTICLES_BY_FAMILLE } from "@/lib/queries";

interface ArticleRow {
  ART_ID: number;
  ART_NOM: string;
  ART_REFMRK: string;
  ARF_CHRONO: string;
  MARQUE: string;
  GENRE: string;
  STOCK_TOTAL: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const famille = searchParams.get("famille");
    const q = searchParams.get("q")?.trim();

    if (!famille) {
      return NextResponse.json(
        { error: "Paramètre 'famille' requis" },
        { status: 400 }
      );
    }

    let rows = await query<ArticleRow>(ARTICLES_BY_FAMILLE, [
      famille.toUpperCase(),
    ]);

    if (q) {
      const term = q.toUpperCase();
      rows = rows.filter(
        (r) =>
          r.ART_NOM?.toUpperCase().includes(term) ||
          r.ART_REFMRK?.toUpperCase().includes(term) ||
          r.ARF_CHRONO?.toUpperCase().includes(term) ||
          r.MARQUE?.toUpperCase().includes(term)
      );
    }

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching articles by famille:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement des articles" },
      { status: 500 }
    );
  }
}
