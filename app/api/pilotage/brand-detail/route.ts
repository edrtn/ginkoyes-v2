import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { PILOTAGE_BRAND_DETAIL } from "@/lib/queries";
import { cached, TTL } from "@/lib/cache";

interface BrandDetailRow {
  ART_ID: number;
  ART_NOM: string;
  ART_REFMRK: string;
  RAYON: string | null;
  FAMILLE: string | null;
  QTE_RECUE: number;
  QTE_VENDUE: number;
  QTE_STOCK: number;
  CA_TTC: number;
  CA_HT: number;
  DERNIERE_VENTE: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get("collectionId");
    const marque = searchParams.get("marque");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!collectionId || !marque || !from || !to) {
      return NextResponse.json(
        { error: "Paramètres collectionId, marque, from et to requis" },
        { status: 400 }
      );
    }

    const colId = Number(collectionId);
    const m = marque.toUpperCase();
    const cacheKey = `pilotage-brand:${colId}:${m}:${from}:${to}`;

    const result = await cached(cacheKey, async () => {
      // Params: collectionId(rec), fromDate, toDate, collectionId(colart), marqueNom
      const rows = await query<BrandDetailRow>(PILOTAGE_BRAND_DETAIL, [
        colId, from, to, colId, m,
      ]);

      return rows.map((r) => {
        const qteRecue = Number(r.QTE_RECUE) || 0;
        const qteVendue = Number(r.QTE_VENDUE) || 0;
        return {
          artId: r.ART_ID,
          nom: r.ART_NOM || "",
          ref: r.ART_REFMRK || "",
          rayon: r.RAYON || "",
          famille: r.FAMILLE || "",
          qteRecue,
          qteVendue,
          qteStock: Number(r.QTE_STOCK) || 0,
          tauxSortie: qteRecue > 0 ? (qteVendue / qteRecue) * 100 : 0,
          caTtc: Number(r.CA_TTC) || 0,
          caHt: Number(r.CA_HT) || 0,
          derniereVente: r.DERNIERE_VENTE || null,
        };
      });
    }, TTL.DEFAULT);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching brand detail:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement du détail marque" },
      { status: 500 }
    );
  }
}
