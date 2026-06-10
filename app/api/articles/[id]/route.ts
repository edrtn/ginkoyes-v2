import { NextRequest, NextResponse } from "next/server";
import { query, queryFirst } from "@/lib/db";
import {
  ARTICLE_DETAIL,
  ARTICLE_COLLECTIONS,
  ARTICLE_BARCODES,
  ARTICLE_STOCK,
} from "@/lib/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const artId = parseInt(id, 10);
    if (isNaN(artId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const [article, collections, barcodes, stock] = await Promise.all([
      queryFirst(ARTICLE_DETAIL, [artId]),
      query(ARTICLE_COLLECTIONS, [artId]),
      query(ARTICLE_BARCODES, [artId]),
      query(ARTICLE_STOCK, [artId]),
    ]);

    if (!article) {
      return NextResponse.json({ error: "Article non trouvé" }, { status: 404 });
    }

    return NextResponse.json({
      ...article,
      collections: collections.map(
        (c: Record<string, unknown>) => c.SAISON
      ),
      barcodes: barcodes.map(
        (b: Record<string, unknown>) => b.CBI_CB
      ),
      stock,
    });
  } catch (error) {
    console.error("Error fetching article:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement de l'article" },
      { status: 500 }
    );
  }
}
