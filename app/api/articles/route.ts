import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { SEARCH_ARTICLES, buildArticleSearchWhere } from "@/lib/queries";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || undefined;
    const marque = searchParams.get("marque") || undefined;
    const rayon = searchParams.get("rayon") || undefined;
    const famille = searchParams.get("famille") || undefined;
    const collection = searchParams.get("collection") || undefined;

    const { where, values } = buildArticleSearchWhere({
      q,
      marque,
      rayon,
      famille,
      collection,
    });

    const sql = `${SEARCH_ARTICLES} ${where} ORDER BY a.ART_NOM LIMIT 50`;
    const rows = await query(sql, values);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error searching articles:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recherche" },
      { status: 500 }
    );
  }
}
