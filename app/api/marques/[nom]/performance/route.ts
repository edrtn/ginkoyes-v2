import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ACHAT_VENTES_COMPARATIF } from "@/lib/queries";
import { cached, TTL } from "@/lib/cache";

interface VenteRow {
  GENRE: string | null;
  CA_TTC: number;
  CA_HT: number;
  QTE: number;
  COUT_TOTAL: number;
}

function buildPeriodData(rows: VenteRow[]) {
  let totalCaTtc = 0;
  let totalCaHt = 0;
  let totalQte = 0;
  let totalCout = 0;

  const parGenre: Record<
    string,
    { genre: string; caTtc: number; caHt: number; qte: number; marge: number; prixMoyen: number }
  > = {};

  for (const row of rows) {
    const caTtc = Number(row.CA_TTC) || 0;
    const caHt = Number(row.CA_HT) || 0;
    const qte = Number(row.QTE) || 0;
    const cout = Number(row.COUT_TOTAL) || 0;
    const genre = row.GENRE || "Autre";

    totalCaTtc += caTtc;
    totalCaHt += caHt;
    totalQte += qte;
    totalCout += cout;

    if (!parGenre[genre]) {
      parGenre[genre] = { genre, caTtc: 0, caHt: 0, qte: 0, marge: 0, prixMoyen: 0 };
    }
    parGenre[genre].caTtc += caTtc;
    parGenre[genre].caHt += caHt;
    parGenre[genre].qte += qte;
    parGenre[genre].marge = parGenre[genre].caHt > 0
      ? ((parGenre[genre].caHt - cout) / parGenre[genre].caHt) * 100
      : 0;
    parGenre[genre].prixMoyen = parGenre[genre].qte > 0
      ? parGenre[genre].caTtc / parGenre[genre].qte
      : 0;
  }

  const totalMarge = totalCaHt > 0 ? ((totalCaHt - totalCout) / totalCaHt) * 100 : 0;
  const totalPrixMoyen = totalQte > 0 ? totalCaTtc / totalQte : 0;

  return {
    total: { caTtc: totalCaTtc, caHt: totalCaHt, qte: totalQte, marge: totalMarge, prixMoyen: totalPrixMoyen },
    parGenre: Object.values(parGenre),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nom: string }> }
) {
  try {
    const { nom } = await params;
    let marque: string;
    try { marque = decodeURIComponent(nom).toUpperCase(); } catch { marque = nom.toUpperCase(); }

    // Auto period: Jan 1 → today for N, same period for N-1
    const now = new Date();
    const yearN = now.getFullYear();
    const yearN1 = yearN - 1;
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    const fromN = `${yearN}-01-01`;
    const toN = `${yearN}-${month}-${day}`;
    const fromN1 = `${yearN1}-01-01`;
    const toN1 = `${yearN1}-${month}-${day}`;

    const cacheKey = `marque-perf:${marque}:${toN}`;

    const result = await cached(cacheKey, async () => {
      const [rowsN, rowsN1] = await Promise.all([
        query<VenteRow>(ACHAT_VENTES_COMPARATIF, [fromN, toN, marque]),
        query<VenteRow>(ACHAT_VENTES_COMPARATIF, [fromN1, toN1, marque]),
      ]);

      const n = buildPeriodData(rowsN);
      const n1 = buildPeriodData(rowsN1);

      const evol = (a: number, b: number) => (b !== 0 ? ((a - b) / Math.abs(b)) * 100 : 0);

      return {
        anneeN: yearN,
        anneeN1: yearN1,
        n,
        n1,
        evolution: {
          caTtc: evol(n.total.caTtc, n1.total.caTtc),
          qte: evol(n.total.qte, n1.total.qte),
          prixMoyen: evol(n.total.prixMoyen, n1.total.prixMoyen),
        },
      };
    }, TTL.DEFAULT);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching brand performance:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement de la performance" },
      { status: 500 }
    );
  }
}
