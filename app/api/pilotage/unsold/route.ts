import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { PILOTAGE_UNSOLD_ARTICLES } from "@/lib/queries";
import { cached, TTL } from "@/lib/cache";

interface UnsoldRow {
  ART_ID: number;
  ART_NOM: string;
  ART_REFMRK: string;
  MARQUE: string | null;
  RAYON: string | null;
  FAMILLE: string | null;
  QTE_STOCK: number;
  VALEUR_STOCK: number;
  DERNIERE_VENTE: string | null;
  JOURS_SANS_VENTE: number | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get("collectionId");

    if (!collectionId) {
      return NextResponse.json(
        { error: "Paramètre collectionId requis" },
        { status: 400 }
      );
    }

    const colId = Number(collectionId);
    const cacheKey = `pilotage-unsold:${colId}`;

    const result = await cached(cacheKey, async () => {
      const rows = await query<UnsoldRow>(PILOTAGE_UNSOLD_ARTICLES, [colId]);

      return rows.map((r) => ({
        artId: r.ART_ID,
        nom: r.ART_NOM || "",
        ref: r.ART_REFMRK || "",
        marque: r.MARQUE || "",
        rayon: r.RAYON || "",
        famille: r.FAMILLE || "",
        qteStock: Number(r.QTE_STOCK) || 0,
        valeurStock: Number(r.VALEUR_STOCK) || 0,
        derniereVente: r.DERNIERE_VENTE || null,
        joursSansVente: Number(r.JOURS_SANS_VENTE) || null,
      }));
    }, TTL.DEFAULT);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching unsold articles:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement des invendus" },
      { status: 500 }
    );
  }
}
