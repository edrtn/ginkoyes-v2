import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { PILOTAGE_SCORE_ACHAT } from "@/lib/queries";
import { cached, TTL } from "@/lib/cache";

interface ScoreRow {
  MARQUE: string;
  NB_MODELES: number;
  QTE_COMMANDEE: number;
  MONTANT_ACHAT_NET: number;
  MONTANT_VENTE: number;
  QTE_RECUE: number;
  MONTANT_ACHAT_REC: number;
  MONTANT_VENTE_REC: number;
  QTE_VENDUE: number;
  CA_TTC: number;
  CA_HT: number;
  CA_TTC_N1: number;
  QTE_STOCK: number;
  VALORISATION: number;
  NB_INVENDUS: number;
  VALEUR_INVENDUS: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get("collectionId");
    const fromN = searchParams.get("fromN");
    const toN = searchParams.get("toN");
    const fromN1 = searchParams.get("fromN1");
    const toN1 = searchParams.get("toN1");

    if (!collectionId || !fromN || !toN || !fromN1 || !toN1) {
      return NextResponse.json(
        { error: "Paramètres collectionId, fromN, toN, fromN1, toN1 requis" },
        { status: 400 }
      );
    }

    const colId = Number(collectionId);
    const cacheKey = `pilotage-score:${colId}:${fromN}:${toN}:${fromN1}:${toN1}`;

    const result = await cached(cacheKey, async () => {
      // Params: colId(cmd), colId(rec), fromN, toN, colId(ven), fromN1, toN1, colId(venN1), colId(stk), colId(inv)
      const rows = await query<ScoreRow>(PILOTAGE_SCORE_ACHAT, [
        colId, colId, fromN, toN, colId, fromN1, toN1, colId, colId, colId,
      ]);

      return rows.map((r) => ({
        marque: r.MARQUE || "",
        nbModeles: Number(r.NB_MODELES) || 0,
        qteCommandee: Number(r.QTE_COMMANDEE) || 0,
        montantAchatNet: Number(r.MONTANT_ACHAT_NET) || 0,
        montantVente: Number(r.MONTANT_VENTE) || 0,
        qteRecue: Number(r.QTE_RECUE) || 0,
        montantAchatRec: Number(r.MONTANT_ACHAT_REC) || 0,
        montantVenteRec: Number(r.MONTANT_VENTE_REC) || 0,
        qteVendue: Number(r.QTE_VENDUE) || 0,
        caTtc: Number(r.CA_TTC) || 0,
        caHt: Number(r.CA_HT) || 0,
        caTtcN1: Number(r.CA_TTC_N1) || 0,
        qteStock: Number(r.QTE_STOCK) || 0,
        valorisation: Number(r.VALORISATION) || 0,
        nbInvendus: Number(r.NB_INVENDUS) || 0,
        valeurInvendus: Number(r.VALEUR_INVENDUS) || 0,
      }));
    }, TTL.DEFAULT);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching pilotage score:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement du score achat" },
      { status: 500 }
    );
  }
}
