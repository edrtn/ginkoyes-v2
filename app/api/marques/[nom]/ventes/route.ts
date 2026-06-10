import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { BRAND_VENTES } from "@/lib/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nom: string }> }
) {
  try {
    const { nom } = await params;
    const marque = decodeURIComponent(nom);

    const rows = await query(BRAND_VENTES, [marque]);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching brand ventes:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement des ventes" },
      { status: 500 }
    );
  }
}
