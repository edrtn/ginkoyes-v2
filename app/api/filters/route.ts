import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { LIST_MARQUES, LIST_RAYONS, LIST_FAMILLES } from "@/lib/queries";
import { cached, TTL } from "@/lib/cache";

export async function GET() {
  try {
    const result = await cached("filters", async () => {
      const [marques, rayons, familles] = await Promise.all([
        query(LIST_MARQUES),
        query(LIST_RAYONS),
        query(LIST_FAMILLES),
      ]);

      return {
        marques: marques.map((m: Record<string, unknown>) => m.MARQUE),
        rayons: rayons.map((r: Record<string, unknown>) => r.RAYON),
        familles: familles.map((f: Record<string, unknown>) => f.FAMILLE),
      };
    }, TTL.LONG);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching filters:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement des filtres" },
      { status: 500 }
    );
  }
}
