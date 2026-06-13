import { NextRequest, NextResponse } from "next/server";
import { query, queryFirst } from "@/lib/db";
import { RECEPTION_HEADER, RECEPTION_LINES } from "@/lib/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const breId = parseInt(id, 10);
    if (isNaN(breId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const [header, lines] = await Promise.all([
      queryFirst(RECEPTION_HEADER, [breId]),
      query(RECEPTION_LINES, [breId]),
    ]);

    if (!header) {
      return NextResponse.json(
        { error: "Réception non trouvée" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ...header, lines });
  } catch (error) {
    console.error("Error fetching reception detail:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement de la réception" },
      { status: 500 }
    );
  }
}
