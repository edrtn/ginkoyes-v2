import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ACHAT_CLASSEMENT_MARQUES_RAYON, ACHAT_CLASSEMENT_MARQUES_FAMILLE } from "@/lib/queries";
import { cached, TTL } from "@/lib/cache";

interface Row {
  MARQUE: string;
  CA: number;
  QTE: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rayon = searchParams.get("rayon");
    const famille = searchParams.get("famille");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!rayon || !from || !to) {
      return NextResponse.json(
        { error: "Paramètres rayon, from, to requis" },
        { status: 400 }
      );
    }

    const cacheKey = `classement-marques:${rayon}:${famille || ""}:${from}:${to}`;

    const rows = await cached(cacheKey, async () => {
      if (famille) {
        return query<Row>(ACHAT_CLASSEMENT_MARQUES_FAMILLE, [from, to, rayon, famille]);
      }
      return query<Row>(ACHAT_CLASSEMENT_MARQUES_RAYON, [from, to, rayon]);
    }, TTL.DEFAULT);

    const total = rows.reduce((s, r) => s + Number(r.CA), 0);
    const result = rows.map((r, i) => ({
      rang: i + 1,
      marque: r.MARQUE,
      ca: Number(r.CA),
      qte: Number(r.QTE),
      part: total > 0 ? (Number(r.CA) / total) * 100 : 0,
    }));

    return NextResponse.json({ items: result, total });
  } catch (error) {
    console.error("Error fetching classement-marques:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement du classement" },
      { status: 500 }
    );
  }
}
