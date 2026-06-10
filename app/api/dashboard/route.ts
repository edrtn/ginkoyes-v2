import { NextRequest, NextResponse } from "next/server";
import { query, queryFirst } from "@/lib/db";
import {
  DASHBOARD_CA_TOTAL,
  DASHBOARD_TOP_ARTICLES,
  DASHBOARD_CA_PAR_RAYON,
  DASHBOARD_CA_PAR_MARQUE,
  DASHBOARD_CA_MENSUEL,
} from "@/lib/queries";
import { cached, TTL } from "@/lib/cache";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Default: current year
    const now = new Date();
    const from = searchParams.get("from") || `${now.getFullYear()}-01-01`;
    const to = searchParams.get("to") || `${now.getFullYear() + 1}-01-01`;

    const cacheKey = `dashboard:${from}:${to}`;

    const result = await cached(cacheKey, async () => {
      const dateParams = [from, to];

      const [caTotal, topArticles, caParRayon, caParMarque, caMensuel] =
        await Promise.all([
          queryFirst(DASHBOARD_CA_TOTAL, dateParams),
          query(DASHBOARD_TOP_ARTICLES, dateParams),
          query(DASHBOARD_CA_PAR_RAYON, dateParams),
          query(DASHBOARD_CA_PAR_MARQUE, dateParams),
          query(DASHBOARD_CA_MENSUEL, dateParams),
        ]);

      const nbTickets =
        Number((caTotal as Record<string, unknown>)?.NB_TICKETS) || 0;
      const caValue =
        Number((caTotal as Record<string, unknown>)?.CA_TOTAL) || 0;
      const panierMoyen = nbTickets > 0 ? caValue / nbTickets : 0;

      return {
        caTotal: caValue,
        nbTickets,
        panierMoyen,
        topArticles,
        caParRayon,
        caParMarque,
        caMensuel,
        from,
        to,
      };
    }, TTL.DEFAULT);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement du dashboard" },
      { status: 500 }
    );
  }
}
