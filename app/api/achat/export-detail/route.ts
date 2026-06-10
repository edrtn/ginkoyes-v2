import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ACHAT_VENTES_DETAIL } from "@/lib/queries";
import { utils, write } from "xlsx";

interface DetailRow {
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

function formatDateFr(d: string | Date): string {
  return new Date(d).toLocaleDateString("fr-FR");
}

function toSheetData(rows: DetailRow[]) {
  return rows.map((r) => ({
    Date: r.DATE_VENTE ? formatDateFr(r.DATE_VENTE) : "",
    Source: String(r.SOURCE).trim(),
    "N° Pièce": r.NUMERO,
    Article: r.ART_NOM,
    "Réf Marque": r.ART_REFMRK,
    Genre: r.GENRE || "",
    Rayon: r.RAYON || "",
    Famille: r.FAMILLE || "",
    Couleur: r.COULEUR || "",
    Taille: r.TAILLE || "",
    Qté: r.QTE,
    "PX Brut": r.PX_BRUT,
    "PX Net TTC": r.PX_NET_TTC,
    "PX Net HT": r.PX_NET_HT,
  }));
}

function sumField(rows: DetailRow[], source: string | null, field: "QTE" | "PX_NET_TTC" | "PX_NET_HT") {
  const filtered = source ? rows.filter((r) => String(r.SOURCE).trim() === source) : rows;
  return filtered.reduce((s, r) => s + (Number(r[field]) || 0), 0);
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
    const yearN1 = fromN1.slice(0, 4);
    const yearN2 = fromN2.slice(0, 4);

    const [rowsN1, rowsN2] = await Promise.all([
      query<DetailRow>(ACHAT_VENTES_DETAIL, [fromN1, toN1, fromN1, toN1, m]),
      query<DetailRow>(ACHAT_VENTES_DETAIL, [fromN2, toN2, fromN2, toN2, m]),
    ]);

    // Summary
    const summary = [
      { "": `COMPARATIF ${m} — ${formatDateFr(fromN1)} au ${formatDateFr(toN1)} vs ${formatDateFr(fromN2)} au ${formatDateFr(toN2)}` },
      {},
      { "": "", [yearN1]: "", [yearN2]: "", Écart: "" },
      { "": "QTE Caisse", [yearN1]: sumField(rowsN1, "CAISSE", "QTE"), [yearN2]: sumField(rowsN2, "CAISSE", "QTE"), Écart: sumField(rowsN1, "CAISSE", "QTE") - sumField(rowsN2, "CAISSE", "QTE") },
      { "": "QTE BL/Internet", [yearN1]: sumField(rowsN1, "BL/INTERNET", "QTE"), [yearN2]: sumField(rowsN2, "BL/INTERNET", "QTE"), Écart: sumField(rowsN1, "BL/INTERNET", "QTE") - sumField(rowsN2, "BL/INTERNET", "QTE") },
      { "": "QTE TOTAL", [yearN1]: sumField(rowsN1, null, "QTE"), [yearN2]: sumField(rowsN2, null, "QTE"), Écart: sumField(rowsN1, null, "QTE") - sumField(rowsN2, null, "QTE") },
      {},
      { "": "CA TTC Caisse", [yearN1]: sumField(rowsN1, "CAISSE", "PX_NET_TTC"), [yearN2]: sumField(rowsN2, "CAISSE", "PX_NET_TTC"), Écart: sumField(rowsN1, "CAISSE", "PX_NET_TTC") - sumField(rowsN2, "CAISSE", "PX_NET_TTC") },
      { "": "CA TTC BL/Internet", [yearN1]: sumField(rowsN1, "BL/INTERNET", "PX_NET_TTC"), [yearN2]: sumField(rowsN2, "BL/INTERNET", "PX_NET_TTC"), Écart: sumField(rowsN1, "BL/INTERNET", "PX_NET_TTC") - sumField(rowsN2, "BL/INTERNET", "PX_NET_TTC") },
      { "": "CA TTC TOTAL", [yearN1]: sumField(rowsN1, null, "PX_NET_TTC"), [yearN2]: sumField(rowsN2, null, "PX_NET_TTC"), Écart: sumField(rowsN1, null, "PX_NET_TTC") - sumField(rowsN2, null, "PX_NET_TTC") },
      {},
      { "": "CA HT Caisse", [yearN1]: sumField(rowsN1, "CAISSE", "PX_NET_HT"), [yearN2]: sumField(rowsN2, "CAISSE", "PX_NET_HT"), Écart: sumField(rowsN1, "CAISSE", "PX_NET_HT") - sumField(rowsN2, "CAISSE", "PX_NET_HT") },
      { "": "CA HT BL/Internet", [yearN1]: sumField(rowsN1, "BL/INTERNET", "PX_NET_HT"), [yearN2]: sumField(rowsN2, "BL/INTERNET", "PX_NET_HT"), Écart: sumField(rowsN1, "BL/INTERNET", "PX_NET_HT") - sumField(rowsN2, "BL/INTERNET", "PX_NET_HT") },
      { "": "CA HT TOTAL", [yearN1]: sumField(rowsN1, null, "PX_NET_HT"), [yearN2]: sumField(rowsN2, null, "PX_NET_HT"), Écart: sumField(rowsN1, null, "PX_NET_HT") - sumField(rowsN2, null, "PX_NET_HT") },
      {},
      { "": "Nb lignes détail", [yearN1]: rowsN1.length, [yearN2]: rowsN2.length },
    ];

    const wb = utils.book_new();

    const wsSummary = utils.json_to_sheet(summary);
    wsSummary["!cols"] = [{ wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    utils.book_append_sheet(wb, wsSummary, "Résumé");

    const colWidths = [
      { wch: 12 }, { wch: 14 }, { wch: 28 }, { wch: 40 }, { wch: 22 },
      { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 8 },
      { wch: 5 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
    ];

    const wsN1 = utils.json_to_sheet(toSheetData(rowsN1));
    wsN1["!cols"] = colWidths;
    utils.book_append_sheet(wb, wsN1, `${yearN1} (${rowsN1.length} lignes)`);

    const wsN2 = utils.json_to_sheet(toSheetData(rowsN2));
    wsN2["!cols"] = colWidths;
    utils.book_append_sheet(wb, wsN2, `${yearN2} (${rowsN2.length} lignes)`);

    const buf = write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${m}_comparatif_${yearN2}_vs_${yearN1}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Error exporting detail:", error instanceof Error ? error.stack : error);
    return NextResponse.json({ error: "Erreur export", detail: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
