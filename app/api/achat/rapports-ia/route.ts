import { NextRequest, NextResponse } from "next/server";
import { query, queryFirst } from "@/lib/db";

interface RapportRow {
  id: number;
  marque: string;
  collection_id: number | null;
  collection_nom: string | null;
  target_year: number;
  from_n1: string;
  to_n1: string;
  from_n2: string;
  to_n2: string;
  contenu: string;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const rapport = await queryFirst<RapportRow>(
        "SELECT id, marque, collection_id, collection_nom, target_year, from_n1, to_n1, from_n2, to_n2, contenu, created_at FROM _rapports_ia WHERE id = ?",
        [id]
      );
      if (!rapport) {
        return NextResponse.json({ error: "Rapport introuvable" }, { status: 404 });
      }
      return NextResponse.json({ rapport });
    }

    const rapports = await query<Omit<RapportRow, "contenu">>(
      "SELECT id, marque, collection_id, collection_nom, target_year, from_n1, to_n1, from_n2, to_n2, created_at FROM _rapports_ia ORDER BY created_at DESC LIMIT 50"
    );
    return NextResponse.json({ rapports });
  } catch (error) {
    console.error("Error in rapports-ia:", error);
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
