import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { RAYONS_WITH_COUNT, FAMILLES_WITH_COUNT } from "@/lib/queries";
import { cached, TTL } from "@/lib/cache";

interface RayonRow {
  RAY_ID: number;
  RAY_NOM: string;
  articleCount: number;
  familleCount: number;
}

interface FamilleRow {
  FAM_ID: number;
  FAM_NOM: string;
  FAM_RAYID: number;
  articleCount: number;
}

export async function GET() {
  try {
    const result = await cached("categories", async () => {
      const [rayons, familles] = await Promise.all([
        query<RayonRow>(RAYONS_WITH_COUNT),
        query<FamilleRow>(FAMILLES_WITH_COUNT),
      ]);

      return { rayons, familles };
    }, TTL.LONG);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement des catégories" },
      { status: 500 }
    );
  }
}
