import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { BRANDS_WITH_STOCK } from "@/lib/queries";
import { cached, TTL } from "@/lib/cache";

interface BrandRow {
  MARQUE: string;
  NB_ARTICLES: number;
  STOCK_TOTAL: number;
}

export async function GET() {
  try {
    const rows = await cached("stock-brands", async () => {
      return query<BrandRow>(BRANDS_WITH_STOCK);
    }, TTL.LONG);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching stock brands:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement des marques" },
      { status: 500 }
    );
  }
}
