import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ACHAT_VENTES_COMPARATIF } from "@/lib/queries";

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
    total: {
      caTtc: totalCaTtc,
      caHt: totalCaHt,
      qte: totalQte,
      marge: totalMarge,
      prixMoyen: totalPrixMoyen,
    },
    parGenre: Object.values(parGenre),
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
    const [rowsN1, rowsN2] = await Promise.all([
      query<VenteRow>(ACHAT_VENTES_COMPARATIF, [fromN1, toN1, fromN1, toN1, m]),
      query<VenteRow>(ACHAT_VENTES_COMPARATIF, [fromN2, toN2, fromN2, toN2, m]),
    ]);

    const n1 = buildPeriodData(rowsN1);
    const n2 = buildPeriodData(rowsN2);

    const evol = (a: number, b: number) => (b !== 0 ? ((a - b) / Math.abs(b)) * 100 : 0);

    const evolution = {
      caTtc: evol(n1.total.caTtc, n2.total.caTtc),
      marge: n1.total.marge - n2.total.marge, // en points
      qte: evol(n1.total.qte, n2.total.qte),
      prixMoyen: evol(n1.total.prixMoyen, n2.total.prixMoyen),
    };

    return NextResponse.json({ n1, n2, evolution });
  } catch (error) {
    console.error("Error fetching comparatif:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement du comparatif" },
      { status: 500 }
    );
  }
}
