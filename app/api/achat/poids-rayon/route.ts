import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ACHAT_POIDS_MARQUE_PAR_RAYON, ACHAT_POIDS_MARQUE_PAR_FAMILLE } from "@/lib/queries";
import { cached, TTL } from "@/lib/cache";

interface RayonRow {
  RAYON: string | null;
  CA_MARQUE: number;
  CA_TOTAL: number;
  QTE_MARQUE: number;
  QTE_TOTAL: number;
}

interface FamilleRow extends RayonRow {
  FAMILLE: string | null;
}

interface Item {
  rayon: string;
  famille: string | null;
  caMarque: number;
  caTotal: number;
  partCa: number;
  qteMarque: number;
  qteTotal: number;
  partQte: number;
}

function toItem(r: RayonRow | FamilleRow, famille: string | null): Item {
  const caMarque = Number(r.CA_MARQUE) || 0;
  const caTotal = Number(r.CA_TOTAL) || 0;
  const qteMarque = Number(r.QTE_MARQUE) || 0;
  const qteTotal = Number(r.QTE_TOTAL) || 0;
  return {
    rayon: r.RAYON!,
    famille,
    caMarque,
    caTotal,
    partCa: caTotal > 0 ? (caMarque / caTotal) * 100 : 0,
    qteMarque,
    qteTotal,
    partQte: qteTotal > 0 ? (qteMarque / qteTotal) * 100 : 0,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const marque = searchParams.get("marque");
    const fromN1 = searchParams.get("fromN1");
    const toN1 = searchParams.get("toN1");
    const fromN2 = searchParams.get("fromN2");
    const toN2 = searchParams.get("toN2");

    if (!marque || !fromN1 || !toN1 || !fromN2 || !toN2) {
      return NextResponse.json(
        { error: "Paramètres marque, fromN1, toN1, fromN2, toN2 requis" },
        { status: 400 }
      );
    }

    const m = marque.toUpperCase();
    const cacheKey = `achat-poids-rayon:${m}:${fromN1}:${toN1}:${fromN2}:${toN2}`;

    const params = (from: string, to: string) => [m, m, from, to, from, to, m];

    const result = await cached(cacheKey, async () => {
      const [rayN1, famN1, rayN2, famN2] = await Promise.all([
        query<RayonRow>(ACHAT_POIDS_MARQUE_PAR_RAYON, params(fromN1, toN1)),
        query<FamilleRow>(ACHAT_POIDS_MARQUE_PAR_FAMILLE, params(fromN1, toN1)),
        query<RayonRow>(ACHAT_POIDS_MARQUE_PAR_RAYON, params(fromN2, toN2)),
        query<FamilleRow>(ACHAT_POIDS_MARQUE_PAR_FAMILLE, params(fromN2, toN2)),
      ]);

      const build = (rayons: RayonRow[], familles: FamilleRow[]): Item[] => [
        ...rayons.filter((r) => r.RAYON).map((r) => toItem(r, null)),
        ...familles.filter((r) => r.RAYON && r.FAMILLE).map((r) => toItem(r, r.FAMILLE!)),
      ];

      return { n1: build(rayN1, famN1), n2: build(rayN2, famN2) };
    }, TTL.DEFAULT);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching poids-rayon:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement du poids par rayon" },
      { status: 500 }
    );
  }
}
