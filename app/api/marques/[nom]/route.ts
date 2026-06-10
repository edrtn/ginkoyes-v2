import { NextRequest, NextResponse } from "next/server";
import { query, queryFirst } from "@/lib/db";
import { BRAND_STATS, BRAND_ARTICLES } from "@/lib/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nom: string }> }
) {
  try {
    const { nom } = await params;
    const marque = decodeURIComponent(nom);

    const [stats, articles] = await Promise.all([
      queryFirst(BRAND_STATS, [marque]),
      query(BRAND_ARTICLES, [marque]),
    ]);

    return NextResponse.json({
      stats: {
        nbArticles: Number(stats?.NB_ARTICLES) || 0,
        totalQte: Number(stats?.TOTAL_QTE) || 0,
        totalValor: Number(stats?.TOTAL_VALOR) || 0,
        pump: stats && Number(stats.TOTAL_QTE) > 0
          ? Number(stats.TOTAL_VALOR) / Number(stats.TOTAL_QTE)
          : 0,
      },
      articles,
    });
  } catch (error) {
    console.error("Error fetching brand:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement de la marque" },
      { status: 500 }
    );
  }
}
