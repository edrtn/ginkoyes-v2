import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { PILOTAGE_ORDER_HISTORY } from "@/lib/queries";
import { cached, TTL } from "@/lib/cache";

interface OrderHistoryRow {
  COL_ID: number;
  SAISON: string;
  DATE_CMD_MIN: string | null;
  DATE_CMD_MAX: string | null;
  QTE_COMMANDEE: number;
  MONTANT_ACHAT_NET: number;
  QTE_RECUE: number;
  QTE_VENDUE: number;
  QTE_VENDUE_TOTAL: number;
  CA_TTC: number;
  DERNIERE_VENTE: string | null;
  QTE_STOCK: number;
  FOURNISSEUR: string;
  SEASON_TO: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const marque = searchParams.get("marque");

    if (!marque) {
      return NextResponse.json(
        { error: "Paramètre marque requis" },
        { status: 400 }
      );
    }

    const m = marque.toUpperCase();
    const cacheKey = `pilotage-order-history:v2:${m}`;

    const result = await cached(cacheKey, async () => {
      // Params: marqueNom ×6 (cmd, cde-dates, rec, ven, stk, fou)
      const rows = await query<OrderHistoryRow>(PILOTAGE_ORDER_HISTORY, [
        m, m, m, m, m, m,
      ]);

      return rows.map((r) => ({
        colId: r.COL_ID,
        saison: r.SAISON || "",
        dateCmdMin: r.DATE_CMD_MIN || null,
        dateCmdMax: r.DATE_CMD_MAX || null,
        qteCommandee: Number(r.QTE_COMMANDEE) || 0,
        montantAchatNet: Number(r.MONTANT_ACHAT_NET) || 0,
        qteRecue: Number(r.QTE_RECUE) || 0,
        qteVendue: Number(r.QTE_VENDUE) || 0,
        qteVenduTotal: Number(r.QTE_VENDUE_TOTAL) || 0,
        caTtc: Number(r.CA_TTC) || 0,
        derniereVente: r.DERNIERE_VENTE || null,
        qteStock: Number(r.QTE_STOCK) || 0,
        fournisseur: r.FOURNISSEUR || "",
        seasonTo: r.SEASON_TO || null,
      }));
    }, TTL.DEFAULT);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching order history:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement de l'historique des commandes" },
      { status: 500 }
    );
  }
}
