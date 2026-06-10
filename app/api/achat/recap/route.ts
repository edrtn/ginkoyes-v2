import { NextRequest, NextResponse } from "next/server";
import { queryFirst } from "@/lib/db";
import { ACHAT_RECAP_COMMANDE } from "@/lib/queries";
import { cached, TTL } from "@/lib/cache";

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

    const m = marque.toUpperCase();
    const cacheKey = `achat-recap:${collectionId}:${m}`;

    const result = await cached(cacheKey, async () => {
    const row = await queryFirst(ACHAT_RECAP_COMMANDE, [
      Number(collectionId),
      m,
    ]);

    if (!row) {
      return {
        nbModeles: 0,
        qteTotale: 0,
        montantAchatBrut: 0,
        montantAchatNet: 0,
        montantVente: 0,
        remise1: 0,
        remise2: 0,
        remise3: 0,
        coeff: 0,
        marge: 0,
      };
    }

    const r = row as Record<string, unknown>;
    const montantAchatBrut = Number(r.MONTANT_ACHAT_BRUT) || 0;
    const montantAchatNet = Number(r.MONTANT_ACHAT_NET) || 0;
    const montantVente = Number(r.MONTANT_VENTE) || 0;
    const coeff = montantAchatNet > 0 ? montantVente / montantAchatNet : 0;
    const marge =
      montantVente > 0
        ? ((montantVente - montantAchatNet) / montantVente) * 100
        : 0;

    const remise1Montant = Number(r.REMISE1_TOTAL) || 0;
    const remise2Montant = Number(r.REMISE2_TOTAL) || 0;
    const remise3Montant = Number(r.REMISE3_TOTAL) || 0;

    const base1 = montantAchatBrut;
    const base2 = base1 - remise1Montant;
    const base3 = base2 - remise2Montant;

    const remise1 = base1 > 0 ? (remise1Montant / base1) * 100 : 0;
    const remise2 = base2 > 0 ? (remise2Montant / base2) * 100 : 0;
    const remise3 = base3 > 0 ? (remise3Montant / base3) * 100 : 0;

    return {
      nbModeles: Number(r.NB_MODELES) || 0,
      qteTotale: Number(r.QTE_TOTALE) || 0,
      montantAchatBrut,
      montantAchatNet,
      montantVente,
      remise1,
      remise2,
      remise3,
      coeff,
      marge,
    };
    }, TTL.DEFAULT);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching recap:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement du récap commande" },
      { status: 500 }
    );
  }
}
