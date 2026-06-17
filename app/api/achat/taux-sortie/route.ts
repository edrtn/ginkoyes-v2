import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ACHAT_TAUX_SORTIE } from "@/lib/queries";
import { cached, TTL } from "@/lib/cache";

interface TauxSortieRow {
  ART_ID: number;
  ART_NOM: string;
  ART_REFMRK: string;
  GENRE: string | null;
  RAYON: string | null;
  FAMILLE: string | null;
  SOUS_FAMILLE: string | null;
  COULEUR: string | null;
  QTE_RECUE: number;
  QTE_VENDUE: number;
  MONTANT_ACHAT_NET: number;
  PX_VENTE_UNITAIRE: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get("collectionId");
    const marque = searchParams.get("marque");

    if (!collectionId || !marque) {
      return NextResponse.json(
        { error: "Paramètres collectionId et marque requis" },
        { status: 400 }
      );
    }

    const colId = Number(collectionId);
    const m = marque.toUpperCase();
    const cacheKey = `achat-taux:${colId}:${m}`;

    const result = await cached(cacheKey, async () => {
      // Params: collectionId, marque
      const rows = await query<TauxSortieRow>(ACHAT_TAUX_SORTIE, [
        colId,
        m,
      ]);

      let totalQteRecue = 0;
      let totalQteVendue = 0;

      const articles = rows.map((r) => {
        const qteRecue = Number(r.QTE_RECUE) || 0;
        const qteVendue = Number(r.QTE_VENDUE) || 0;
        totalQteRecue += qteRecue;
        totalQteVendue += qteVendue;

        return {
          artId: r.ART_ID,
          nom: r.ART_NOM,
          ref: r.ART_REFMRK,
          genre: r.GENRE || "",
          couleur: r.COULEUR || "",
          rayon: r.RAYON || "",
          famille: r.FAMILLE || "",
          sousFamille: r.SOUS_FAMILLE || "",
          qteRecue,
          qteVendue,
          tauxSortie: qteRecue > 0 ? (qteVendue / qteRecue) * 100 : 0,
          montantAchatNet: Number(r.MONTANT_ACHAT_NET) || 0,
          pxVente: Number(r.PX_VENTE_UNITAIRE) || 0,
        };
      });

      return {
        articles,
        totaux: {
          qteRecue: totalQteRecue,
          qteVendue: totalQteVendue,
          tauxSortieMoyen:
            totalQteRecue > 0 ? (totalQteVendue / totalQteRecue) * 100 : 0,
        },
      };
    }, TTL.DEFAULT);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching taux de sortie:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement du taux de sortie" },
      { status: 500 }
    );
  }
}
