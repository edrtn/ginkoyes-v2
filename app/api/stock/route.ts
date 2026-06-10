import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { STOCK_GLOBAL, buildStockWhere } from "@/lib/queries";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || undefined;
    const marque = searchParams.get("marque") || undefined;
    const rayon = searchParams.get("rayon") || undefined;
    const collection = searchParams.get("collection") || undefined;

    const { where, values } = buildStockWhere({ q, marque, rayon, collection });

    const sql = `${STOCK_GLOBAL} ${where} GROUP BY a.ART_ID, a.ART_NOM, a.ART_REFMRK, mrk.MRK_NOM, ray.RAY_NOM ORDER BY STOCK_TOTAL DESC LIMIT 100`;
    const rows = await query(sql, values);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching stock:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement du stock" },
      { status: 500 }
    );
  }
}
