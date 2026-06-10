import { NextRequest, NextResponse } from "next/server";
import { query, queryFirst } from "@/lib/db";
import { LIST_COLLECTIONS, INSERT_COLLECTION } from "@/lib/queries";

export async function GET() {
  try {
    const collections = await query(LIST_COLLECTIONS);
    return NextResponse.json({ collections });
  } catch (error) {
    console.error("Error fetching collections:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement des collections" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { nom } = await request.json();
    if (!nom || typeof nom !== "string" || nom.trim().length === 0) {
      return NextResponse.json(
        { error: "Le nom de la collection est requis" },
        { status: 400 }
      );
    }

    const trimmedNom = nom.trim().toUpperCase();

    // INSERT (COL_ID is computed via subquery, not AUTO_INCREMENT)
    await query(INSERT_COLLECTION, [trimmedNom]);

    // Retrieve the inserted row by name
    const row = await queryFirst(
      `SELECT COL_ID, COL_NOM FROM ARTCOLLECTION WHERE COL_NOM = ? ORDER BY COL_ID DESC LIMIT 1`,
      [trimmedNom]
    );

    if (!row) {
      return NextResponse.json(
        { error: "Erreur lors de la création" },
        { status: 500 }
      );
    }

    return NextResponse.json({ collection: row });
  } catch (error) {
    console.error("Error creating collection:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la collection" },
      { status: 500 }
    );
  }
}
