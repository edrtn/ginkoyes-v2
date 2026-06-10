import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { STATS_ANNUELLES } from "@/lib/queries";
import { cached, TTL } from "@/lib/cache";

export async function GET() {
  try {
    const stats = await cached("stats:annuelles", async () => {
      const rows = await query(STATS_ANNUELLES);

      return (rows as Record<string, unknown>[]).map((r) => {
        const nbTickets = Number(r.NB_TICKETS) || 0;
        const nbArticles = Number(r.NB_ARTICLES) || 0;
        const ca = Number(r.CA) || 0;
        return {
          annee: Number(r.ANNEE),
          ca,
          nbTickets,
          nbArticles,
          panierMoyen: nbTickets > 0 ? ca / nbTickets : 0,
          indiceVente: nbTickets > 0 ? nbArticles / nbTickets : 0,
        };
      });
    }, TTL.DEFAULT);

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching yearly stats:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement des stats annuelles" },
      { status: 500 }
    );
  }
}
