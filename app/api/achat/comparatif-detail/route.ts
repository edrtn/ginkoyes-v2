import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ACHAT_VENTES_DETAIL, ACHAT_VENTES_COMPARATIF_PAR_SOURCE } from "@/lib/queries";

interface DetailRow {
  ART_ID: number;
  SOURCE: string;
  DATE_VENTE: string;
  NUMERO: string;
  ART_NOM: string;
  ART_REFMRK: string;
  GENRE: string | null;
  COULEUR: string | null;
  TAILLE: string | null;
  RAYON: string | null;
  FAMILLE: string | null;
  QTE: number;
  PX_BRUT: number;
  PX_NET_TTC: number;
  PX_NET_HT: number;
}

interface SourceRow {
  SOURCE: string;
  CA_TTC: number;
  CA_HT: number;
  QTE: number;
  COUT_TOTAL: number;
}

function buildSourceData(rows: SourceRow[]) {
  const result: Record<string, { caTtc: number; caHt: number; qte: number; marge: number; prixMoyen: number }> = {};
  for (const row of rows) {
    const source = String(row.SOURCE).trim();
    const caTtc = Number(row.CA_TTC) || 0;
    const caHt = Number(row.CA_HT) || 0;
    const qte = Number(row.QTE) || 0;
    const cout = Number(row.COUT_TOTAL) || 0;
    const marge = caHt > 0 ? ((caHt - cout) / caHt) * 100 : 0;
    const prixMoyen = qte > 0 ? caTtc / qte : 0;
    result[source] = { caTtc, caHt, qte, marge, prixMoyen };
  }
  return result;
}

function formatLine(r: DetailRow) {
  return {
    artId: Number(r.ART_ID) || 0,
    source: String(r.SOURCE).trim(),
    date: r.DATE_VENTE,
    numero: r.NUMERO,
    article: r.ART_NOM,
    ref: r.ART_REFMRK,
    genre: r.GENRE || "",
    couleur: r.COULEUR || "",
    taille: r.TAILLE || "",
    qte: Number(r.QTE) || 0,
    pxNetTtc: Number(r.PX_NET_TTC) || 0,
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
      return NextResponse.json({ error: "Params requis" }, { status: 400 });
    }

    const m = marque.toUpperCase();

    const [linesN1, linesN2, srcN1, srcN2] = await Promise.all([
      query<DetailRow>(ACHAT_VENTES_DETAIL, [fromN1, toN1, fromN1, toN1, m]),
      query<DetailRow>(ACHAT_VENTES_DETAIL, [fromN2, toN2, fromN2, toN2, m]),
      query<SourceRow>(ACHAT_VENTES_COMPARATIF_PAR_SOURCE, [fromN1, toN1, fromN1, toN1, m]),
      query<SourceRow>(ACHAT_VENTES_COMPARATIF_PAR_SOURCE, [fromN2, toN2, fromN2, toN2, m]),
    ]);

    const n1ParSource = buildSourceData(srcN1);
    const n2ParSource = buildSourceData(srcN2);

    // Evolution par source
    const evol = (a: number, b: number) => (b !== 0 ? ((a - b) / Math.abs(b)) * 100 : 0);
    const sources = [...new Set([...Object.keys(n1ParSource), ...Object.keys(n2ParSource)])];
    const evolutionParSource: Record<string, { caTtc: number; qte: number; marge: number }> = {};
    for (const src of sources) {
      const s1 = n1ParSource[src] || { caTtc: 0, caHt: 0, qte: 0, marge: 0, prixMoyen: 0 };
      const s2 = n2ParSource[src] || { caTtc: 0, caHt: 0, qte: 0, marge: 0, prixMoyen: 0 };
      evolutionParSource[src] = {
        caTtc: evol(s1.caTtc, s2.caTtc),
        qte: evol(s1.qte, s2.qte),
        marge: s1.marge - s2.marge,
      };
    }

    return NextResponse.json({
      n1: { lines: linesN1.map(formatLine), parSource: n1ParSource },
      n2: { lines: linesN2.map(formatLine), parSource: n2ParSource },
      evolutionParSource,
    });
  } catch (error) {
    console.error("Error fetching comparatif-detail:", error instanceof Error ? error.stack : error);
    return NextResponse.json(
      { error: "Erreur", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
