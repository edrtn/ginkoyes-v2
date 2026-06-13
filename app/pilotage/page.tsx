"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ── Types ──────────────────────────────────────────────

interface Collection {
  COL_ID: number;
  COL_NOM: string;
}

interface ScoreRow {
  marque: string;
  nbModeles: number;
  qteCommandee: number;
  montantAchatNet: number;
  montantVente: number;
  qteRecue: number;
  montantAchatRec: number;
  montantVenteRec: number;
  qteVendue: number;
  caTtc: number;
  caHt: number;
  caTtcN1: number;
  qteStock: number;
  valorisation: number;
  nbInvendus: number;
  valeurInvendus: number;
}

interface ScoreComputed extends ScoreRow {
  tauxEcoulement: number;
  croissanceCa: number;
  marge: number;
  rotation: number;
  tauxInvendus: number;
  score: number;
  recommandation: "AUGMENTER" | "STABLE" | "RÉDUIRE";
  justification: string;
}

interface UnsoldArticle {
  artId: number;
  nom: string;
  ref: string;
  marque: string;
  rayon: string;
  famille: string;
  qteStock: number;
  valeurStock: number;
  derniereVente: string | null;
  joursSansVente: number | null;
}

interface BrandDetailArticle {
  artId: number;
  nom: string;
  ref: string;
  rayon: string;
  famille: string;
  qteRecue: number;
  qteVendue: number;
  qteStock: number;
  tauxSortie: number;
  caTtc: number;
  caHt: number;
  derniereVente: string | null;
}

interface Alert {
  type: "danger" | "warning" | "info" | "success";
  marque: string;
  message: string;
}

// ── Helpers ────────────────────────────────────────────

function formatEuro(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function formatEuroDec(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(n: number) {
  return `${n.toFixed(1)}%`;
}

function formatDateFr(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR");
  } catch {
    return d;
  }
}

function extractYear(colName: string): number {
  const m = colName.match(/\d{4}/);
  return m ? parseInt(m[0]) : new Date().getFullYear();
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
};

// ── Score calculation ──────────────────────────────────

const DEFAULT_WEIGHTS = {
  ecoulement: 30,
  croissance: 20,
  marge: 20,
  rotation: 15,
  invendus: 15,
};

function computeScore(row: ScoreRow, weights: typeof DEFAULT_WEIGHTS): ScoreComputed {
  const qteRecue = row.qteRecue || row.qteCommandee;
  const tauxEcoulement = qteRecue > 0 ? (row.qteVendue / qteRecue) * 100 : 0;
  const croissanceCa = row.caTtcN1 > 0 ? ((row.caTtc - row.caTtcN1) / row.caTtcN1) * 100 : 0;
  const marge = row.caTtc > 0 && row.montantAchatNet > 0
    ? ((row.caTtc - row.montantAchatNet) / row.caTtc) * 100
    : 0;
  const rotation = row.valorisation > 0 ? row.caTtc / row.valorisation : 0;
  const tauxInvendus = qteRecue > 0 ? (row.nbInvendus / qteRecue) * 100 : 0;

  const scoreEcoulement = Math.min(100, (tauxEcoulement / 80) * 100);
  const scoreCroissance = Math.min(100, Math.max(0, ((croissanceCa + 20) / 30) * 100));
  const scoreMarge = Math.min(100, (marge / 60) * 100);
  const scoreRotation = Math.min(100, (rotation / 4) * 100);
  const scoreInvendus = Math.max(0, 100 - tauxInvendus * 5);

  const totalWeight = weights.ecoulement + weights.croissance + weights.marge + weights.rotation + weights.invendus;
  const score = totalWeight > 0
    ? (scoreEcoulement * weights.ecoulement +
       scoreCroissance * weights.croissance +
       scoreMarge * weights.marge +
       scoreRotation * weights.rotation +
       scoreInvendus * weights.invendus) / totalWeight
    : 0;

  const recommandation: ScoreComputed["recommandation"] =
    score >= 80 ? "AUGMENTER" : score >= 60 ? "STABLE" : "RÉDUIRE";

  const points: string[] = [];
  if (tauxEcoulement >= 70) points.push(`Bon écoulement (${formatPct(tauxEcoulement)})`);
  else if (tauxEcoulement < 40) points.push(`Écoulement faible (${formatPct(tauxEcoulement)})`);
  if (croissanceCa > 10) points.push(`CA en hausse (${croissanceCa > 0 ? "+" : ""}${formatPct(croissanceCa)})`);
  else if (croissanceCa < -10) points.push(`CA en baisse (${formatPct(croissanceCa)})`);
  if (marge >= 55) points.push(`Bonne marge (${formatPct(marge)})`);
  else if (marge < 40) points.push(`Marge faible (${formatPct(marge)})`);
  if (rotation >= 3) points.push(`Bonne rotation (${rotation.toFixed(1)}x)`);
  else if (rotation < 1) points.push(`Rotation lente (${rotation.toFixed(1)}x)`);
  if (row.valeurInvendus > 3000) points.push(`Invendus importants (${formatEuro(row.valeurInvendus)})`);

  return {
    ...row,
    tauxEcoulement,
    croissanceCa,
    marge,
    rotation,
    tauxInvendus,
    score: Math.round(score),
    recommandation,
    justification: points.join(" · ") || "Données insuffisantes",
  };
}

function generateAlerts(data: ScoreComputed[]): Alert[] {
  const alerts: Alert[] = [];
  for (const d of data) {
    if (d.tauxEcoulement < 30 && d.qteRecue > 0)
      alerts.push({ type: "danger", marque: d.marque, message: `Taux de sortie critique : ${formatPct(d.tauxEcoulement)}` });
    if (d.valeurInvendus > 5000)
      alerts.push({ type: "warning", marque: d.marque, message: `Invendus élevés : ${formatEuro(d.valeurInvendus)}` });
    if (d.rotation > 0 && d.rotation < 1)
      alerts.push({ type: "warning", marque: d.marque, message: `Rotation faible : ${d.rotation.toFixed(1)}x/an` });
    if (d.valorisation > 0 && d.caTtc > 0 && d.valorisation > d.caTtc * 0.5)
      alerts.push({ type: "info", marque: d.marque, message: `Stock > 50% du CA (${formatEuro(d.valorisation)})` });
    if (d.croissanceCa > 30)
      alerts.push({ type: "success", marque: d.marque, message: `Forte croissance : +${formatPct(d.croissanceCa)}` });
  }
  return alerts;
}

// ── Sort helpers ───────────────────────────────────────

type SortKey = "marque" | "score" | "caTtc" | "marge" | "tauxEcoulement" | "valorisation" | "montantAchatNet" | "croissanceCa";

function sortData(data: ScoreComputed[], key: SortKey, asc: boolean): ScoreComputed[] {
  return [...data].sort((a, b) => {
    const va = key === "marque" ? a.marque.toLowerCase() : a[key];
    const vb = key === "marque" ? b.marque.toLowerCase() : b[key];
    if (va < vb) return asc ? -1 : 1;
    if (va > vb) return asc ? 1 : -1;
    return 0;
  });
}

// ── Component ──────────────────────────────────────────

export default function PilotagePage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<number | null>(null);
  const [marqueFilter, setMarqueFilter] = useState("");

  const [scoreData, setScoreData] = useState<ScoreRow[]>([]);
  const [unsoldData, setUnsoldData] = useState<UnsoldArticle[]>([]);
  const [brandDetail, setBrandDetail] = useState<BrandDetailArticle[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingUnsold, setLoadingUnsold] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortAsc, setSortAsc] = useState(false);
  const [unsoldSort, setUnsoldSort] = useState<{ key: string; asc: boolean }>({ key: "valeurStock", asc: false });
  const [weights] = useState(DEFAULT_WEIGHTS);

  const [simMarque, setSimMarque] = useState("");
  const [simFactor, setSimFactor] = useState(20);

  useEffect(() => {
    fetch("/api/achat/collections")
      .then((r) => r.json())
      .then((data) => {
        if (data.collections && Array.isArray(data.collections)) {
          setCollections(data.collections);
        }
      })
      .catch(() => {});
  }, []);

  const dateRanges = useMemo(() => {
    if (!selectedCollection) return null;
    const col = collections.find((c) => c.COL_ID === selectedCollection);
    if (!col) return null;

    const year = extractYear(col.COL_NOM);
    const colNameUpper = col.COL_NOM.toUpperCase();

    let fromN: string, toN: string, fromN1: string, toN1: string;

    if (colNameUpper.includes("HIVER") || colNameUpper.includes("FW") || colNameUpper.includes("AH")) {
      fromN = `${year}-07-01`;
      toN = `${year + 1}-01-01`;
      fromN1 = `${year - 1}-07-01`;
      toN1 = `${year}-01-01`;
    } else {
      fromN = `${year}-01-01`;
      toN = `${year}-07-01`;
      fromN1 = `${year - 1}-01-01`;
      toN1 = `${year - 1}-07-01`;
    }

    return { fromN, toN, fromN1, toN1 };
  }, [selectedCollection, collections]);

  const loadScore = useCallback(async () => {
    if (!selectedCollection || !dateRanges) return;

    setLoading(true);
    setError(null);
    setSelectedBrand(null);
    setBrandDetail([]);

    try {
      const params = new URLSearchParams({
        collectionId: String(selectedCollection),
        fromN: dateRanges.fromN,
        toN: dateRanges.toN,
        fromN1: dateRanges.fromN1,
        toN1: dateRanges.toN1,
      });
      const res = await fetch(`/api/pilotage/score?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setScoreData(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [selectedCollection, dateRanges]);

  useEffect(() => {
    loadScore();
  }, [loadScore]);

  const loadUnsold = useCallback(async () => {
    if (!selectedCollection || unsoldData.length > 0) return;
    setLoadingUnsold(true);
    try {
      const res = await fetch(`/api/pilotage/unsold?collectionId=${selectedCollection}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUnsoldData(Array.isArray(data) ? data : []);
    } catch {
      // silent
    } finally {
      setLoadingUnsold(false);
    }
  }, [selectedCollection, unsoldData.length]);

  const loadBrandDetail = useCallback(async (marque: string) => {
    if (!selectedCollection || !dateRanges) return;
    setSelectedBrand(marque);
    setLoadingDetail(true);
    try {
      const params = new URLSearchParams({
        collectionId: String(selectedCollection),
        marque,
        from: dateRanges.fromN,
        to: dateRanges.toN,
      });
      const res = await fetch(`/api/pilotage/brand-detail?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setBrandDetail(Array.isArray(data) ? data : []);
    } catch {
      setBrandDetail([]);
    } finally {
      setLoadingDetail(false);
    }
  }, [selectedCollection, dateRanges]);

  const computedData = useMemo(() => {
    let data = scoreData.map((r) => computeScore(r, weights));
    if (marqueFilter) {
      data = data.filter((d) => d.marque.toUpperCase().includes(marqueFilter.toUpperCase()));
    }
    return sortData(data, sortKey, sortAsc);
  }, [scoreData, weights, sortKey, sortAsc, marqueFilter]);

  const kpis = useMemo(() => {
    const d = computedData;
    const totalAchat = d.reduce((s, r) => s + r.montantAchatNet, 0);
    const totalVente = d.reduce((s, r) => s + r.caTtc, 0);
    const totalStock = d.reduce((s, r) => s + r.valorisation, 0);
    const totalRecue = d.reduce((s, r) => s + r.qteRecue, 0);
    const totalVendue = d.reduce((s, r) => s + r.qteVendue, 0);
    const tauxEcoulement = totalRecue > 0 ? (totalVendue / totalRecue) * 100 : 0;
    const marge = totalVente > 0 ? ((totalVente - totalAchat) / totalVente) * 100 : 0;
    const rotation = totalStock > 0 ? totalVente / totalStock : 0;
    const totalInvendus = d.reduce((s, r) => s + r.valeurInvendus, 0);

    return { totalAchat, totalVente, totalStock, tauxEcoulement, marge, rotation, totalInvendus };
  }, [computedData]);

  const alerts = useMemo(() => generateAlerts(computedData), [computedData]);

  // Generate global analysis text
  const globalAnalysis = useMemo(() => {
    if (computedData.length === 0) return null;
    const nbMarques = computedData.length;
    const top3 = computedData.filter((d) => d.score >= 80);
    const bottom3 = computedData.filter((d) => d.score < 60);
    const stable = computedData.filter((d) => d.score >= 60 && d.score < 80);
    const bestMarque = computedData.reduce((best, r) => r.score > best.score ? r : best, computedData[0]);
    const worstMarque = computedData.reduce((worst, r) => r.score < worst.score ? r : worst, computedData[0]);
    const totalCA = computedData.reduce((s, r) => s + r.caTtc, 0);
    const top3CA = computedData.slice(0, 3).reduce((s, r) => s + r.caTtc, 0);
    const top3Pct = totalCA > 0 ? (top3CA / totalCA) * 100 : 0;

    const lines: string[] = [];
    lines.push(`Cette saison regroupe **${nbMarques} marques** analysées.`);

    if (top3.length > 0) {
      lines.push(`**${top3.length} marque${top3.length > 1 ? "s" : ""}** ${top3.length > 1 ? "obtiennent" : "obtient"} un score excellent (${"\u2265"}80) et ${top3.length > 1 ? "méritent" : "mérite"} une augmentation de budget : ${top3.slice(0, 5).map((d) => `**${d.marque}** (${d.score})`).join(", ")}.`);
    }
    if (bottom3.length > 0) {
      lines.push(`**${bottom3.length} marque${bottom3.length > 1 ? "s" : ""}** ${bottom3.length > 1 ? "sont" : "est"} en difficulté (score < 60) et ${bottom3.length > 1 ? "nécessitent" : "nécessite"} une réduction : ${bottom3.slice(0, 5).map((d) => `**${d.marque}** (${d.score})`).join(", ")}.`);
    }
    if (stable.length > 0) {
      lines.push(`**${stable.length} marque${stable.length > 1 ? "s" : ""}** ${stable.length > 1 ? "sont" : "est"} en zone stable (60-79) : budget à maintenir.`);
    }

    lines.push(`Les 3 premières marques représentent **${formatPct(top3Pct)}** du CA total.`);

    if (bestMarque) {
      lines.push(`**Meilleure marque : ${bestMarque.marque}** avec un score de ${bestMarque.score}/100. ${bestMarque.justification}.`);
    }
    if (worstMarque && worstMarque.marque !== bestMarque?.marque) {
      lines.push(`**Marque la plus faible : ${worstMarque.marque}** avec un score de ${worstMarque.score}/100. ${worstMarque.justification}.`);
    }

    return lines;
  }, [computedData]);

  // Generate per-brand detailed explanation
  const getBrandExplanation = useCallback((row: ScoreComputed): string => {
    const parts: string[] = [];

    // Écoulement
    if (row.tauxEcoulement >= 80) {
      parts.push(`L'écoulement est excellent (${formatPct(row.tauxEcoulement)}) : la quasi-totalité du stock commandé a été vendue, ce qui montre une forte demande client.`);
    } else if (row.tauxEcoulement >= 60) {
      parts.push(`L'écoulement est correct (${formatPct(row.tauxEcoulement)}) : une bonne partie du stock a été vendue, mais il reste de la marchandise.`);
    } else if (row.tauxEcoulement >= 40) {
      parts.push(`L'écoulement est moyen (${formatPct(row.tauxEcoulement)}) : moins de la moitié du stock a été vendue. Il faut questionner le choix des modèles ou les quantités commandées.`);
    } else if (row.qteRecue > 0) {
      parts.push(`L'écoulement est faible (${formatPct(row.tauxEcoulement)}) : la majorité du stock reste invendu. Cette marque ne correspond peut-être pas à la clientèle ou les quantités étaient trop importantes.`);
    }

    // Croissance
    if (row.caTtcN1 > 0) {
      if (row.croissanceCa > 20) {
        parts.push(`Le CA est en forte hausse (+${formatPct(row.croissanceCa)} vs N-1), signe d'une demande croissante.`);
      } else if (row.croissanceCa > 5) {
        parts.push(`Le CA progresse légèrement (+${formatPct(row.croissanceCa)} vs N-1).`);
      } else if (row.croissanceCa > -5) {
        parts.push(`Le CA est stable par rapport à N-1 (${row.croissanceCa > 0 ? "+" : ""}${formatPct(row.croissanceCa)}).`);
      } else if (row.croissanceCa > -20) {
        parts.push(`Le CA recule (${formatPct(row.croissanceCa)} vs N-1). La marque perd en attractivité ou la concurrence est plus forte.`);
      } else {
        parts.push(`Le CA est en chute sévère (${formatPct(row.croissanceCa)} vs N-1). Il est urgent de revoir la stratégie sur cette marque.`);
      }
    } else {
      parts.push(`Pas de données N-1 pour comparer l'évolution du CA.`);
    }

    // Marge
    if (row.marge >= 60) {
      parts.push(`La marge est très bonne (${formatPct(row.marge)}), ce qui assure une rentabilité solide.`);
    } else if (row.marge >= 50) {
      parts.push(`La marge est correcte (${formatPct(row.marge)}).`);
    } else if (row.marge >= 35) {
      parts.push(`La marge est faible (${formatPct(row.marge)}). Vérifier les conditions d'achat et les remises accordées en vente.`);
    } else if (row.montantAchatNet > 0) {
      parts.push(`La marge est insuffisante (${formatPct(row.marge)}). Cette marque coûte presque autant qu'elle rapporte.`);
    }

    // Rotation
    if (row.rotation >= 4) {
      parts.push(`Excellente rotation du stock (${row.rotation.toFixed(1)}x/an) : le stock se renouvelle rapidement.`);
    } else if (row.rotation >= 2) {
      parts.push(`Rotation correcte (${row.rotation.toFixed(1)}x/an).`);
    } else if (row.rotation >= 1) {
      parts.push(`Rotation lente (${row.rotation.toFixed(1)}x/an) : le stock met du temps à se vendre.`);
    } else if (row.valorisation > 0) {
      parts.push(`Rotation très faible (${row.rotation.toFixed(1)}x/an) : le stock dort en réserve et immobilise de la trésorerie.`);
    }

    // Invendus
    if (row.valeurInvendus > 5000) {
      parts.push(`Attention : ${formatEuro(row.valeurInvendus)} d'invendus (${row.nbInvendus} articles sans vente depuis 12 mois). Ce stock mort pèse sur la trésorerie.`);
    } else if (row.valeurInvendus > 1000) {
      parts.push(`${formatEuro(row.valeurInvendus)} d'invendus à surveiller.`);
    } else if (row.nbInvendus === 0 && row.qteRecue > 0) {
      parts.push(`Aucun invendu : tous les articles ont été vendus au cours des 12 derniers mois.`);
    }

    // Recommandation
    if (row.recommandation === "AUGMENTER") {
      parts.push(`Recommandation : AUGMENTER le budget. Cette marque performe bien et mérite davantage d'investissement pour capter la demande.`);
    } else if (row.recommandation === "STABLE") {
      parts.push(`Recommandation : MAINTENIR le budget au même niveau. La marque est correcte mais n'a pas de dynamique suffisante pour justifier une hausse.`);
    } else {
      parts.push(`Recommandation : RÉDUIRE le budget. Les indicateurs sont insuffisants, il vaut mieux réallouer ce budget vers des marques plus performantes.`);
    }

    return parts.join(" ");
  }, []);

  useEffect(() => {
    setUnsoldData([]);
  }, [selectedCollection]);

  const sortedUnsold = useMemo(() => {
    const key = unsoldSort.key as keyof UnsoldArticle;
    return [...unsoldData].sort((a, b) => {
      const va = a[key] ?? 0;
      const vb = b[key] ?? 0;
      if (va < vb) return unsoldSort.asc ? -1 : 1;
      if (va > vb) return unsoldSort.asc ? 1 : -1;
      return 0;
    });
  }, [unsoldData, unsoldSort]);

  const simResult = useMemo(() => {
    if (!simMarque) return null;
    const row = computedData.find((d) => d.marque === simMarque);
    if (!row) return null;
    const factor = 1 + simFactor / 100;
    return {
      marque: row.marque,
      investissement: row.montantAchatNet * factor,
      investissementActuel: row.montantAchatNet,
      caProjecte: row.caTtc * factor,
      caActuel: row.caTtc,
      margePct: row.marge,
      margeProjectee: (row.caTtc * factor - row.montantAchatNet * factor),
      stockSupp: Math.round(row.qteCommandee * (factor - 1)),
    };
  }, [simMarque, simFactor, computedData]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sortIcon = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pilotage Achats Saisonniers</h1>
          <p className="text-sm text-gray-500">Analyse de performance et recommandations d&apos;achat par marque</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Saison *</label>
          <select
            value={selectedCollection ?? ""}
            onChange={(e) => setSelectedCollection(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none min-w-[220px]"
          >
            <option value="">Sélectionner une saison...</option>
            {collections.map((c) => (
              <option key={c.COL_ID} value={c.COL_ID}>{c.COL_NOM}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Filtrer par marque</label>
          <input
            type="text"
            value={marqueFilter}
            onChange={(e) => setMarqueFilter(e.target.value)}
            placeholder="Rechercher..."
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none w-48"
          />
        </div>
        {dateRanges && (
          <div className="text-xs text-gray-400 self-center">
            Période N : {dateRanges.fromN} → {dateRanges.toN} | N-1 : {dateRanges.fromN1} → {dateRanges.toN1}
          </div>
        )}
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="space-y-3 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
            <p className="text-sm text-gray-500">Chargement des données...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && selectedCollection && computedData.length > 0 && (
        <Tabs defaultValue={0}>
          <TabsList className="mb-6">
            <TabsTrigger value={0} className="px-4 py-2">
              Tableau de bord
            </TabsTrigger>
            <TabsTrigger value={1} className="px-4 py-2">
              Performance
            </TabsTrigger>
            <TabsTrigger value={2} className="px-4 py-2">
              Écoulement
            </TabsTrigger>
            <TabsTrigger
              value={3}
              className="px-4 py-2"
              onClick={() => loadUnsold()}
            >
              Invendus
            </TabsTrigger>
            <TabsTrigger value={4} className="px-4 py-2">
              Simulateur
            </TabsTrigger>
          </TabsList>

          {/* ═══ TAB 1: Tableau de bord ═══ */}
          <TabsContent value={0}>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
              {[
                { label: "Valeur achetée", value: formatEuro(kpis.totalAchat), gradient: "from-emerald-500 to-emerald-600", glow: "glow-emerald" },
                { label: "CA vendu", value: formatEuro(kpis.totalVente), gradient: "from-teal-500 to-teal-600", glow: "glow-teal" },
                { label: "Taux écoulement", value: formatPct(kpis.tauxEcoulement), gradient: "from-cyan-500 to-cyan-600", glow: "glow-sky" },
                { label: "Marge", value: formatPct(kpis.marge), gradient: "from-emerald-600 to-teal-500", glow: "glow-emerald" },
                { label: "Stock restant", value: formatEuro(kpis.totalStock), gradient: "from-gray-500 to-gray-600", glow: "" },
                { label: "Rotation", value: `${kpis.rotation.toFixed(1)}x`, gradient: "from-teal-600 to-cyan-500", glow: "glow-teal" },
                { label: "Invendus >12m", value: formatEuro(kpis.totalInvendus), gradient: kpis.totalInvendus > 10000 ? "from-red-500 to-red-600" : "from-gray-500 to-gray-600", glow: kpis.totalInvendus > 10000 ? "glow-rose" : "" },
              ].map((kpi, i) => (
                <Card key={i} className={`relative overflow-hidden border-0 bg-gradient-to-br ${kpi.gradient} text-white shadow-lg ${kpi.glow} animate-fade-in-up stagger-${Math.min(i + 1, 4)}`}>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-[10px] uppercase tracking-wider text-white/70">{kpi.label}</p>
                    <p className="text-lg font-bold mt-1">{kpi.value}</p>
                    <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Global Analysis */}
            {globalAnalysis && (
              <Card className="border-0 shadow-sm mb-6 animate-fade-in-up stagger-1">
                <CardContent className="p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                    </svg>
                    Analyse globale de la saison
                  </h3>
                  <div className="space-y-2">
                    {globalAnalysis.map((line, i) => (
                      <p key={i} className="text-sm text-gray-600 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900">$1</strong>') }}
                      />
                    ))}
                  </div>
                  {kpis.tauxEcoulement > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-gray-50 text-xs text-gray-600 leading-relaxed">
                      <strong className="text-gray-700">En résumé :</strong> Sur cette saison, vous avez investi {formatEuro(kpis.totalAchat)} et généré {formatEuro(kpis.totalVente)} de CA
                      (marge globale de {formatPct(kpis.marge)}). Le taux d&apos;écoulement global est de {formatPct(kpis.tauxEcoulement)}
                      {kpis.tauxEcoulement >= 70 ? " — c'est un bon résultat." : kpis.tauxEcoulement >= 50 ? " — il y a de la marge de progression." : " — c'est insuffisant, trop de stock reste invendu."}
                      {kpis.totalInvendus > 5000 && ` Attention : ${formatEuro(kpis.totalInvendus)} de stock dort depuis plus de 12 mois.`}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Alerts */}
            {alerts.length > 0 && (
              <div className="mb-6 space-y-1.5 animate-fade-in-up stagger-1">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Alertes automatiques</h3>
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {alerts.map((a, i) => (
                    <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                      a.type === "danger" ? "bg-red-50 text-red-700 border border-red-200" :
                      a.type === "warning" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                      a.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                      "bg-gray-50 text-gray-600 border border-gray-200"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        a.type === "danger" ? "bg-red-500" : a.type === "warning" ? "bg-amber-500" :
                        a.type === "success" ? "bg-emerald-500" : "bg-gray-400"
                      }`} />
                      <span className="font-medium">{a.marque}</span>
                      <span>{a.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Score Achat Table */}
            <div className="mb-2">
              <h3 className="text-sm font-bold text-gray-900">Score Achat par marque</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Cliquez sur une marque pour voir le détail article par article. Les colonnes sont triables. Le score /100 synthétise 5 critères (écoulement, croissance, marge, rotation, invendus).
              </p>
            </div>
            <Card className="border-0 shadow-sm animate-fade-in-up stagger-2">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-900" onClick={() => handleSort("marque")}>
                          Marque{sortIcon("marque")}
                        </th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-900" onClick={() => handleSort("score")}>
                          Score{sortIcon("score")}
                        </th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500">Reco.</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-900" onClick={() => handleSort("montantAchatNet")}>
                          Achat HT{sortIcon("montantAchatNet")}
                        </th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-900" onClick={() => handleSort("caTtc")}>
                          Ventes TTC{sortIcon("caTtc")}
                        </th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-900" onClick={() => handleSort("marge")}>
                          Marge %{sortIcon("marge")}
                        </th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-900" onClick={() => handleSort("tauxEcoulement")}>
                          Écoulement{sortIcon("tauxEcoulement")}
                        </th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-900" onClick={() => handleSort("croissanceCa")}>
                          Croissance{sortIcon("croissanceCa")}
                        </th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-900" onClick={() => handleSort("valorisation")}>
                          Stock{sortIcon("valorisation")}
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Justification</th>
                      </tr>
                    </thead>
                    <tbody>
                      {computedData.map((row, idx) => (
                        <tr
                          key={`${row.marque}-${idx}`}
                          className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => loadBrandDetail(row.marque)}
                        >
                          <td className="px-3 py-2 font-medium text-gray-900">{row.marque}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              row.score >= 80 ? "bg-emerald-100 text-emerald-700" :
                              row.score >= 60 ? "bg-amber-100 text-amber-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              {row.score}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-xs font-semibold ${
                              row.recommandation === "AUGMENTER" ? "text-emerald-600" :
                              row.recommandation === "STABLE" ? "text-amber-600" :
                              "text-red-600"
                            }`}>
                              {row.recommandation === "AUGMENTER" ? "↑" : row.recommandation === "STABLE" ? "=" : "↓"} {row.recommandation}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">{formatEuro(row.montantAchatNet)}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{formatEuro(row.caTtc)}</td>
                          <td className="px-3 py-2 text-right">
                            <span className={row.marge >= 55 ? "text-emerald-600" : row.marge >= 40 ? "text-gray-700" : "text-red-600"}>
                              {formatPct(row.marge)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className={row.tauxEcoulement >= 70 ? "text-emerald-600" : row.tauxEcoulement >= 40 ? "text-gray-700" : "text-red-600"}>
                              {formatPct(row.tauxEcoulement)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className={row.croissanceCa > 0 ? "text-emerald-600" : row.croissanceCa < -5 ? "text-red-600" : "text-gray-700"}>
                              {row.croissanceCa > 0 ? "+" : ""}{formatPct(row.croissanceCa)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">{formatEuro(row.valorisation)}</td>
                          <td className="px-3 py-2 text-xs text-gray-400 max-w-[200px] truncate">{row.justification}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Brand Detail Drawer */}
            {selectedBrand && (
              <div className="mt-4 animate-fade-in-up">
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-900">
                        Détail articles — {selectedBrand}
                      </h3>
                      <button
                        onClick={() => { setSelectedBrand(null); setBrandDetail([]); }}
                        className="text-gray-400 hover:text-gray-700 text-xs"
                      >
                        Fermer
                      </button>
                    </div>
                    {/* Brand explanation */}
                    {(() => {
                      const brandRow = computedData.find((d) => d.marque === selectedBrand);
                      if (!brandRow) return null;
                      return (
                        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              brandRow.score >= 80 ? "bg-emerald-100 text-emerald-700" :
                              brandRow.score >= 60 ? "bg-amber-100 text-amber-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              Score : {brandRow.score}/100
                            </span>
                            <span className={`text-xs font-semibold ${
                              brandRow.recommandation === "AUGMENTER" ? "text-emerald-600" :
                              brandRow.recommandation === "STABLE" ? "text-amber-600" : "text-red-600"
                            }`}>
                              {brandRow.recommandation === "AUGMENTER" ? "↑" : brandRow.recommandation === "STABLE" ? "=" : "↓"} {brandRow.recommandation}
                            </span>
                          </div>
                          <p className="text-xs text-gray-700 leading-relaxed">
                            {getBrandExplanation(brandRow)}
                          </p>
                        </div>
                      );
                    })()}
                    {loadingDetail ? (
                      <div className="flex items-center gap-2 py-4">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                        <span className="text-sm text-gray-500">Chargement...</span>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-100 text-gray-500">
                              <th className="px-2 py-1.5 text-left">Article</th>
                              <th className="px-2 py-1.5 text-left">Réf</th>
                              <th className="px-2 py-1.5 text-left">Rayon</th>
                              <th className="px-2 py-1.5 text-right">Reçu</th>
                              <th className="px-2 py-1.5 text-right">Vendu</th>
                              <th className="px-2 py-1.5 text-right">Stock</th>
                              <th className="px-2 py-1.5 text-right">Taux sortie</th>
                              <th className="px-2 py-1.5 text-right">CA TTC</th>
                              <th className="px-2 py-1.5 text-right">Dernière vente</th>
                            </tr>
                          </thead>
                          <tbody>
                            {brandDetail.map((art) => (
                              <tr key={art.artId} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-2 py-1.5 text-gray-900 max-w-[180px] truncate">{art.nom}</td>
                                <td className="px-2 py-1.5 text-gray-500">{art.ref}</td>
                                <td className="px-2 py-1.5 text-gray-500">{art.rayon}</td>
                                <td className="px-2 py-1.5 text-right text-gray-700">{art.qteRecue}</td>
                                <td className="px-2 py-1.5 text-right text-gray-700">{art.qteVendue}</td>
                                <td className="px-2 py-1.5 text-right text-gray-700">{art.qteStock}</td>
                                <td className="px-2 py-1.5 text-right">
                                  <span className={art.tauxSortie >= 70 ? "text-emerald-600" : art.tauxSortie >= 40 ? "text-gray-700" : "text-red-600"}>
                                    {formatPct(art.tauxSortie)}
                                  </span>
                                </td>
                                <td className="px-2 py-1.5 text-right text-gray-700">{formatEuroDec(art.caTtc)}</td>
                                <td className="px-2 py-1.5 text-right text-gray-500">{formatDateFr(art.derniereVente)}</td>
                              </tr>
                            ))}
                            {brandDetail.length === 0 && (
                              <tr><td colSpan={9} className="px-2 py-4 text-center text-gray-400">Aucun article trouvé</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ═══ TAB 2: Performance ═══ */}
          <TabsContent value={1}>
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Performance par marque</h2>

              <Card className="border-0 shadow-sm bg-teal-50/50">
                <CardContent className="p-5 space-y-3">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <svg className="h-4 w-4 text-teal-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                    Comprendre ce tableau
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Ce tableau détaille la <strong className="text-gray-800">rentabilité de chaque marque</strong> sur la saison sélectionnée. Il vous permet de comparer les marques entre elles sur plusieurs axes financiers.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                    <div className="flex gap-2">
                      <span className="text-teal-500 font-bold shrink-0">Marge %</span>
                      <span>Différence entre le prix de vente et le coût d&apos;achat. Une marge haute ({">"}55%) est en vert, une marge faible ({"<"}40%) est en rouge.</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-teal-500 font-bold shrink-0">Coeff</span>
                      <span>Coefficient multiplicateur = CA TTC / Achat HT. Un coeff de 2.5 signifie que 1€ acheté génère 2,50€ de ventes.</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-teal-500 font-bold shrink-0">Rotation</span>
                      <span>Nombre de fois que le stock se renouvelle en un an. Plus c&apos;est élevé, plus la marque tourne vite (idéal : {">"}4x).</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-teal-500 font-bold shrink-0">Évolution</span>
                      <span>Croissance du CA par rapport à la saison N-1. Permet de repérer les marques en croissance ou en déclin.</span>
                    </div>
                  </div>
                  {(() => {
                    const bestMarge = computedData.reduce((best, r) => r.marge > best.marge ? r : best, computedData[0]);
                    const bestRotation = computedData.reduce((best, r) => r.rotation > best.rotation ? r : best, computedData[0]);
                    const bestCroissance = computedData.reduce((best, r) => r.croissanceCa > best.croissanceCa ? r : best, computedData[0]);
                    return (
                      <p className="text-xs text-gray-500 leading-relaxed bg-white rounded-lg p-2.5">
                        <strong className="text-gray-700">Points clés :</strong>{" "}
                        La meilleure marge est <strong className="text-gray-700">{bestMarge?.marque}</strong> ({formatPct(bestMarge?.marge)}),
                        la rotation la plus rapide est <strong className="text-gray-700">{bestRotation?.marque}</strong> ({bestRotation?.rotation.toFixed(1)}x),
                        et la plus forte croissance est <strong className="text-gray-700">{bestCroissance?.marque}</strong> ({bestCroissance?.croissanceCa > 0 ? "+" : ""}{formatPct(bestCroissance?.croissanceCa)}).
                      </p>
                    );
                  })()}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Marque</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Achat HT</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Vente TTC</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Vente HT</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Marge brute</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Marge %</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Coeff</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Rotation</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">CA N-1</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Évolution</th>
                        </tr>
                      </thead>
                      <tbody>
                        {computedData.map((row, idx) => {
                          const margeBrute = row.caTtc - row.montantAchatNet;
                          const coeff = row.montantAchatNet > 0 ? row.caTtc / row.montantAchatNet : 0;
                          return (
                            <tr key={`${row.marque}-${idx}`} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium text-gray-900">{row.marque}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{formatEuro(row.montantAchatNet)}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{formatEuro(row.caTtc)}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{formatEuro(row.caHt)}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{formatEuro(margeBrute)}</td>
                              <td className="px-3 py-2 text-right">
                                <span className={row.marge >= 55 ? "text-emerald-600" : row.marge < 40 ? "text-red-600" : "text-gray-700"}>
                                  {formatPct(row.marge)}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right text-gray-700">{coeff.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{row.rotation.toFixed(1)}x</td>
                              <td className="px-3 py-2 text-right text-gray-500">{formatEuro(row.caTtcN1)}</td>
                              <td className="px-3 py-2 text-right">
                                <span className={row.croissanceCa > 0 ? "text-emerald-600" : row.croissanceCa < -5 ? "text-red-600" : "text-gray-700"}>
                                  {row.croissanceCa > 0 ? "+" : ""}{formatPct(row.croissanceCa)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 font-semibold text-gray-900">
                          <td className="px-3 py-2">TOTAL</td>
                          <td className="px-3 py-2 text-right">{formatEuro(computedData.reduce((s, r) => s + r.montantAchatNet, 0))}</td>
                          <td className="px-3 py-2 text-right">{formatEuro(computedData.reduce((s, r) => s + r.caTtc, 0))}</td>
                          <td className="px-3 py-2 text-right">{formatEuro(computedData.reduce((s, r) => s + r.caHt, 0))}</td>
                          <td className="px-3 py-2 text-right">{formatEuro(computedData.reduce((s, r) => s + r.caTtc - r.montantAchatNet, 0))}</td>
                          <td className="px-3 py-2 text-right">{formatPct(kpis.marge)}</td>
                          <td className="px-3 py-2 text-right">—</td>
                          <td className="px-3 py-2 text-right">{kpis.rotation.toFixed(1)}x</td>
                          <td className="px-3 py-2 text-right">{formatEuro(computedData.reduce((s, r) => s + r.caTtcN1, 0))}</td>
                          <td className="px-3 py-2 text-right">—</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="border-0 shadow-sm">
                  <CardContent className="pt-6">
                    <h3 className="mb-4 text-sm font-semibold text-gray-700">Top CA par marque</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={computedData.slice(0, 10).map((r) => ({ name: r.marque.slice(0, 12), CA: Math.round(r.caTtc), Achat: Math.round(r.montantAchatNet) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend />
                        <Line type="monotone" dataKey="CA" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: "#10b981" }} />
                        <Line type="monotone" dataKey="Achat" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3, fill: "#94a3b8" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                  <CardContent className="pt-6">
                    <h3 className="mb-4 text-sm font-semibold text-gray-700">Score Achat par marque</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={computedData.slice(0, 15).map((r) => ({ name: r.marque.slice(0, 12), Score: r.score, Ecoulement: Math.round(r.tauxEcoulement) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} domain={[0, 100]} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend />
                        <Line type="monotone" dataKey="Score" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: "#10b981" }} />
                        <Line type="monotone" dataKey="Ecoulement" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3, fill: "#14b8a6" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ═══ TAB 3: Écoulement ═══ */}
          <TabsContent value={2}>
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Courbe d&apos;écoulement</h2>

              <Card className="border-0 shadow-sm bg-cyan-50/50">
                <CardContent className="p-5 space-y-3">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <svg className="h-4 w-4 text-cyan-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                    </svg>
                    Qu&apos;est-ce que l&apos;écoulement ?
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    L&apos;écoulement mesure <strong className="text-gray-800">quelle proportion de la marchandise achetée a été effectivement vendue</strong>. C&apos;est l&apos;indicateur le plus important pour évaluer si un achat a été pertinent : une marque qui s&apos;écoule bien signifie que vos clients l&apos;apprécient et que vous avez commandé la bonne quantité.
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-emerald-50 p-2.5 text-center">
                      <span className="block font-bold text-emerald-700 text-sm">70%+</span>
                      <span className="text-emerald-600">Excellent</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">La marque s&apos;écoule bien, le stock résiduel est faible.</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-2.5 text-center">
                      <span className="block font-bold text-amber-700 text-sm">40-69%</span>
                      <span className="text-amber-600">Moyen</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">Il reste du stock. Vérifiez si un effort commercial est nécessaire.</p>
                    </div>
                    <div className="rounded-lg bg-red-50 p-2.5 text-center">
                      <span className="block font-bold text-red-700 text-sm">{"<"}40%</span>
                      <span className="text-red-600">Insuffisant</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">Trop de stock invendu. Réduire les achats la prochaine fois.</p>
                    </div>
                  </div>
                  {(() => {
                    const good = computedData.filter(r => r.tauxEcoulement >= 70).length;
                    const medium = computedData.filter(r => r.tauxEcoulement >= 40 && r.tauxEcoulement < 70).length;
                    const bad = computedData.filter(r => r.tauxEcoulement < 40).length;
                    return (
                      <p className="text-xs text-gray-500 leading-relaxed bg-white rounded-lg p-2.5">
                        <strong className="text-gray-700">Sur cette saison :</strong>{" "}
                        <strong className="text-emerald-600">{good}</strong> marque{good > 1 ? "s" : ""} s&apos;écoule{good > 1 ? "nt" : ""} bien ({">"}70%),{" "}
                        <strong className="text-amber-600">{medium}</strong> sont dans la moyenne,{" "}
                        et <strong className="text-red-600">{bad}</strong> sont en dessous de 40%.
                        {bad > good && " Il y a plus de marques en difficulté qu'en bonne santé : revoyez votre portefeuille de marques."}
                        {good > bad * 2 && " Globalement votre sélection de marques s'écoule bien, c'est un bon signal."}
                      </p>
                    );
                  })()}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Marque</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Qté reçue</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Qté vendue</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Stock restant</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Taux écoulement</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-[200px]">Progression</th>
                        </tr>
                      </thead>
                      <tbody>
                        {computedData.map((row, idx) => (
                          <tr key={`${row.marque}-${idx}`} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-900">{row.marque}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{row.qteRecue}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{row.qteVendue}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{row.qteStock}</td>
                            <td className="px-3 py-2 text-right">
                              <span className={row.tauxEcoulement >= 70 ? "text-emerald-600" : row.tauxEcoulement >= 40 ? "text-gray-700" : "text-red-600"}>
                                {formatPct(row.tauxEcoulement)}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      row.tauxEcoulement >= 70 ? "bg-emerald-500" :
                                      row.tauxEcoulement >= 40 ? "bg-amber-500" : "bg-red-500"
                                    }`}
                                    style={{ width: `${Math.min(100, row.tauxEcoulement)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardContent className="pt-6">
                  <h3 className="mb-4 text-sm font-semibold text-gray-700">Comparaison des taux d&apos;écoulement</h3>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={computedData
                      .filter((r) => r.qteRecue > 0)
                      .slice(0, 20)
                      .map((r) => ({
                        name: r.marque.slice(0, 10),
                        Ecoulement: Math.round(r.tauxEcoulement),
                        Rotation: Math.round(r.rotation * 25),
                      }))
                    }>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} angle={-45} textAnchor="end" height={60} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} domain={[0, 100]} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Line type="monotone" dataKey="Ecoulement" stroke="#10b981" strokeWidth={2} name="% Écoulement" />
                      <Line type="monotone" dataKey="Rotation" stroke="#06b6d4" strokeWidth={2} name="Rotation (échelle)" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ═══ TAB 4: Invendus ═══ */}
          <TabsContent value={3}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Articles invendus</h2>
                  <p className="text-sm text-gray-500">Articles en stock sans vente depuis plus de 12 mois</p>
                </div>
                {unsoldData.length > 0 && (
                  <div className="text-sm text-gray-500">
                    {unsoldData.length} articles — {formatEuro(unsoldData.reduce((s, r) => s + r.valeurStock, 0))} immobilisés
                  </div>
                )}
              </div>

              <Card className="border-0 shadow-sm bg-red-50/50">
                <CardContent className="p-5 space-y-3">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    Pourquoi surveiller les invendus ?
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Un article <strong className="text-gray-800">invendu</strong> est un article qui est en stock mais qui n&apos;a fait l&apos;objet d&apos;aucune vente depuis plus de <strong className="text-gray-800">12 mois</strong>. C&apos;est de l&apos;argent immobilisé qui ne rapporte rien : il occupe de la place en réserve, ne génère pas de chiffre d&apos;affaires, et perd de la valeur avec le temps (obsolescence, démodage).
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Ces articles sont un <strong className="text-gray-800">signal d&apos;alerte</strong> pour vos prochains achats : si une marque génère beaucoup d&apos;invendus, c&apos;est que certains modèles ne correspondent pas à la demande de votre clientèle. Vous pouvez envisager plusieurs actions :
                  </p>
                  <ul className="text-xs text-gray-600 space-y-1.5 ml-4">
                    <li className="flex gap-2">
                      <span className="text-red-500 font-bold">1.</span>
                      <span><strong className="text-gray-700">Soldez</strong> ces articles pour libérer de la trésorerie, même à perte.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-red-500 font-bold">2.</span>
                      <span><strong className="text-gray-700">Réduisez les quantités</strong> chez le fournisseur lors du prochain achat de cette marque.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-red-500 font-bold">3.</span>
                      <span><strong className="text-gray-700">Ciblez mieux</strong> : évitez les familles ou rayons qui s&apos;écoulent mal et concentrez-vous sur les best-sellers.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-red-500 font-bold">4.</span>
                      <span><strong className="text-gray-700">Questionnez le choix de marque</strong> : s&apos;il y a trop d&apos;invendus, cette marque est-elle adaptée à votre zone de chalandise ?</span>
                    </li>
                  </ul>
                  {unsoldData.length > 0 && (() => {
                    const totalVal = unsoldData.reduce((s, r) => s + r.valeurStock, 0);
                    const topMarques = Object.entries(
                      unsoldData.reduce<Record<string, number>>((acc, r) => { acc[r.marque] = (acc[r.marque] || 0) + r.valeurStock; return acc; }, {})
                    ).sort((a, b) => b[1] - a[1]).slice(0, 3);
                    return (
                      <p className="text-xs text-gray-500 leading-relaxed bg-white rounded-lg p-2.5">
                        <strong className="text-gray-700">Sur cette saison :</strong>{" "}
                        <strong className="text-red-600">{unsoldData.length}</strong> articles dorment en stock pour un total de <strong className="text-red-600">{formatEuro(totalVal)}</strong>.
                        {topMarques.length > 0 && <>{" "}Les marques les plus concernées : {topMarques.map((m, i) => <span key={i}><strong className="text-gray-700">{m[0]}</strong> ({formatEuro(m[1])}){i < topMarques.length - 1 ? ", " : "."}</span>)}</>}
                      </p>
                    );
                  })()}
                </CardContent>
              </Card>

              {loadingUnsold ? (
                <div className="flex items-center gap-2 py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  <span className="text-gray-500">Chargement des invendus...</span>
                </div>
              ) : unsoldData.length === 0 ? (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-6 text-center text-gray-400">
                    {selectedCollection ? "Aucun invendu trouvé pour cette saison. Cliquez sur l'onglet pour charger les données." : "Sélectionnez une saison"}
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            {[
                              { key: "nom", label: "Article", align: "text-left" },
                              { key: "ref", label: "Réf", align: "text-left" },
                              { key: "marque", label: "Marque", align: "text-left" },
                              { key: "rayon", label: "Rayon", align: "text-left" },
                              { key: "famille", label: "Famille", align: "text-left" },
                              { key: "qteStock", label: "Qté stock", align: "text-right" },
                              { key: "valeurStock", label: "Valeur", align: "text-right" },
                              { key: "derniereVente", label: "Dernière vente", align: "text-right" },
                              { key: "joursSansVente", label: "Jours sans vente", align: "text-right" },
                            ].map((col) => (
                              <th
                                key={col.key}
                                className={`px-3 py-2.5 ${col.align} text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-900`}
                                onClick={() => {
                                  if (unsoldSort.key === col.key) setUnsoldSort({ key: col.key, asc: !unsoldSort.asc });
                                  else setUnsoldSort({ key: col.key, asc: false });
                                }}
                              >
                                {col.label}{unsoldSort.key === col.key ? (unsoldSort.asc ? " ↑" : " ↓") : ""}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedUnsold.map((art) => (
                            <tr key={art.artId} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="px-3 py-1.5 text-gray-900 max-w-[200px] truncate">{art.nom}</td>
                              <td className="px-3 py-1.5 text-gray-500">{art.ref}</td>
                              <td className="px-3 py-1.5 text-gray-700">{art.marque}</td>
                              <td className="px-3 py-1.5 text-gray-500">{art.rayon}</td>
                              <td className="px-3 py-1.5 text-gray-500">{art.famille}</td>
                              <td className="px-3 py-1.5 text-right text-gray-700">{art.qteStock}</td>
                              <td className="px-3 py-1.5 text-right text-red-600 font-medium">{formatEuroDec(art.valeurStock)}</td>
                              <td className="px-3 py-1.5 text-right text-gray-500">{formatDateFr(art.derniereVente)}</td>
                              <td className="px-3 py-1.5 text-right">
                                <span className={`${(art.joursSansVente ?? 999) > 365 ? "text-red-600" : "text-amber-600"}`}>
                                  {art.joursSansVente ?? "Jamais"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ═══ TAB 5: Simulateur ═══ */}
          <TabsContent value={4}>
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Simulateur d&apos;achat</h2>

              <Card className="border-0 shadow-sm bg-emerald-50/50">
                <CardContent className="p-5 space-y-3">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25v-.008zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007v-.008zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z" />
                    </svg>
                    Comment utiliser le simulateur ?
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Le simulateur vous permet de répondre à la question : <strong className="text-gray-800">&quot;Si j&apos;augmente (ou réduis) mon budget d&apos;achat de X% chez une marque, quel serait l&apos;impact sur mon CA et ma marge ?&quot;</strong>
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Il se base sur les <strong className="text-gray-800">performances réelles</strong> de la saison sélectionnée et projette proportionnellement. Par exemple, si une marque a généré 50 000€ de CA avec un achat de 20 000€ et que vous augmentez de +20%, le simulateur projette un achat de 24 000€ et un CA de 60 000€.
                  </p>
                  <div className="text-xs text-gray-500 bg-white rounded-lg p-2.5 leading-relaxed">
                    <strong className="text-gray-700">Attention :</strong> Les projections sont <strong className="text-gray-700">proportionnelles</strong> et supposent que les performances (marge, taux d&apos;écoulement) restent identiques. En réalité, augmenter fortement les achats peut entraîner un surplus de stock si la demande ne suit pas. Utilisez ces chiffres comme un <strong className="text-gray-700">ordre de grandeur</strong> pour vos décisions, pas comme une prévision exacte.
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardContent className="p-6 space-y-4">
                  <div className="flex flex-wrap gap-4 items-end">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Marque</label>
                      <select
                        value={simMarque}
                        onChange={(e) => setSimMarque(e.target.value)}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none min-w-[200px]"
                      >
                        <option value="">Sélectionner...</option>
                        {computedData.map((d, i) => (
                          <option key={`${d.marque}-${i}`} value={d.marque}>{d.marque}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Variation : <span className={simFactor >= 0 ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>
                          {simFactor >= 0 ? "+" : ""}{simFactor}%
                        </span>
                      </label>
                      <input
                        type="range"
                        min={-50}
                        max={100}
                        step={5}
                        value={simFactor}
                        onChange={(e) => setSimFactor(Number(e.target.value))}
                        className="w-64 accent-emerald-500"
                      />
                    </div>
                  </div>

                  {simResult && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4 animate-fade-in-up">
                      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg glow-emerald">
                        <CardContent className="pt-4 pb-3">
                          <p className="text-[10px] uppercase tracking-wider text-emerald-100">Investissement projeté</p>
                          <p className="text-xl font-bold mt-1">{formatEuro(simResult.investissement)}</p>
                          <p className="text-xs text-emerald-200 mt-0.5">
                            Actuel : {formatEuro(simResult.investissementActuel)}
                            <span className="ml-1">
                              ({simFactor >= 0 ? "+" : ""}{formatEuro(simResult.investissement - simResult.investissementActuel)})
                            </span>
                          </p>
                          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10" />
                        </CardContent>
                      </Card>
                      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-lg glow-teal">
                        <CardContent className="pt-4 pb-3">
                          <p className="text-[10px] uppercase tracking-wider text-teal-100">CA projeté</p>
                          <p className="text-xl font-bold mt-1">{formatEuro(simResult.caProjecte)}</p>
                          <p className="text-xs text-teal-200 mt-0.5">
                            Actuel : {formatEuro(simResult.caActuel)}
                          </p>
                          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10" />
                        </CardContent>
                      </Card>
                      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-lg glow-sky">
                        <CardContent className="pt-4 pb-3">
                          <p className="text-[10px] uppercase tracking-wider text-cyan-100">Marge projetée</p>
                          <p className="text-xl font-bold mt-1">{formatEuro(simResult.margeProjectee)}</p>
                          <p className="text-xs text-cyan-200 mt-0.5">
                            Taux : {formatPct(simResult.margePct)}
                          </p>
                          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10" />
                        </CardContent>
                      </Card>
                      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-gray-600 to-gray-700 text-white shadow-lg">
                        <CardContent className="pt-4 pb-3">
                          <p className="text-[10px] uppercase tracking-wider text-gray-300">Stock supplémentaire</p>
                          <p className="text-xl font-bold mt-1">
                            {simResult.stockSupp >= 0 ? "+" : ""}{simResult.stockSupp} pcs
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Pièces commandées en {simFactor >= 0 ? "plus" : "moins"}
                          </p>
                          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10" />
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {simResult && (() => {
                    const brandRow = computedData.find(d => d.marque === simMarque);
                    if (!brandRow) return null;
                    return (
                      <div className="mt-2 p-3 rounded-lg bg-gray-50 text-xs text-gray-600 leading-relaxed space-y-1.5">
                        <p>
                          <strong className="text-gray-700">Contexte de cette simulation :</strong>{" "}
                          Sur la saison en cours, <strong className="text-gray-700">{simMarque}</strong> a un score de <strong className="text-gray-700">{brandRow.score}/100</strong> avec
                          un taux d&apos;écoulement de {formatPct(brandRow.tauxEcoulement)}, une marge de {formatPct(brandRow.marge)} et une rotation de {brandRow.rotation.toFixed(1)}x.
                        </p>
                        <p>
                          {simFactor > 0
                            ? `En augmentant de +${simFactor}%, vous investiriez ${formatEuro(simResult.investissement - simResult.investissementActuel)} de plus. Si les performances se maintiennent, cela générerait ${formatEuro(simResult.caProjecte - simResult.caActuel)} de CA supplémentaire et ${simResult.stockSupp} pièces commandées en plus.`
                            : simFactor < 0
                            ? `En réduisant de ${simFactor}%, vous économiseriez ${formatEuro(simResult.investissementActuel - simResult.investissement)} d'achat. Le CA projeté baisserait à ${formatEuro(simResult.caProjecte)}.`
                            : "Aucune variation appliquée. Déplacez le curseur pour simuler un changement de budget."
                          }
                        </p>
                        {simFactor > 30 && brandRow.tauxEcoulement < 60 && (
                          <p className="text-amber-600">
                            <strong>Prudence :</strong> cette marque a un écoulement modeste ({formatPct(brandRow.tauxEcoulement)}). Augmenter fortement le budget pourrait générer du stock invendu supplémentaire.
                          </p>
                        )}
                        {simFactor > 0 && brandRow.score >= 80 && (
                          <p className="text-emerald-600">
                            <strong>Bon choix :</strong> cette marque a un excellent score ({brandRow.score}/100). Augmenter le budget est cohérent avec ses performances.
                          </p>
                        )}
                        {simFactor < -20 && brandRow.score >= 70 && (
                          <p className="text-amber-600">
                            <strong>Attention :</strong> cette marque performe bien (score {brandRow.score}/100). Une réduction importante pourrait vous faire perdre du CA sur un segment porteur.
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {simMarque && !simResult && (
                    <div className="text-sm text-gray-400 py-4">
                      Données insuffisantes pour cette marque
                    </div>
                  )}

                  {!simMarque && (
                    <div className="text-sm text-gray-400 py-4">
                      Sélectionnez une marque ci-dessus puis déplacez le curseur pour projeter l&apos;impact d&apos;une variation de budget
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {!loading && !error && selectedCollection && computedData.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          Aucune donnée trouvée pour cette saison
        </div>
      )}

      {!selectedCollection && !loading && (
        <div className="max-w-3xl mx-auto py-10 space-y-6">
          <div className="text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 mb-4">
              <svg className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Bienvenue dans le Pilotage Achats</h2>
            <p className="text-sm text-gray-500">
              Cet outil vous aide à répondre à une question clé : <strong className="text-gray-700">combien investir chez chaque marque pour la prochaine saison ?</strong>
            </p>
          </div>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-bold text-gray-900">Pourquoi commencer par sélectionner une saison ?</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Chaque saison (Printemps/Été, Automne/Hiver) correspond à un cycle d&apos;achat complet : vous passez vos commandes, recevez la marchandise, la vendez, puis analysez ce qu&apos;il reste en stock. Pour évaluer vos marques, il faut comparer les données d&apos;une saison précise : combien vous avez acheté, combien vous avez vendu, et ce qui reste.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                En sélectionnant par exemple <strong className="text-gray-700">PRINTEMPS ETE 2025</strong>, l&apos;outil va automatiquement :
              </p>
              <ul className="text-sm text-gray-600 space-y-2 ml-4">
                <li className="flex gap-2">
                  <span className="text-emerald-500 font-bold">1.</span>
                  <span>Récupérer toutes les <strong className="text-gray-700">commandes et réceptions</strong> de cette collection (ce que vous avez acheté)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-500 font-bold">2.</span>
                  <span>Calculer les <strong className="text-gray-700">ventes réalisées</strong> sur la période correspondante (janvier à juin pour une saison PE)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-500 font-bold">3.</span>
                  <span>Comparer avec la <strong className="text-gray-700">saison précédente</strong> (N-1) pour mesurer la croissance</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-500 font-bold">4.</span>
                  <span>Analyser le <strong className="text-gray-700">stock restant</strong> et les <strong className="text-gray-700">invendus</strong> (articles sans vente depuis 12 mois)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-500 font-bold">5.</span>
                  <span>Calculer un <strong className="text-gray-700">Score Achat /100</strong> pour chaque marque et vous donner une recommandation : augmenter, maintenir ou réduire le budget</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-3">
              <h3 className="text-sm font-bold text-gray-900">Comment est calculé le Score Achat ?</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Le score combine 5 critères pondérés pour évaluer objectivement chaque marque :
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { pct: "30%", label: "Taux d'écoulement", desc: "Quelle part du stock acheté a été vendue ? Un taux de 80% ou plus donne le score maximum." },
                  { pct: "20%", label: "Croissance du CA", desc: "Le chiffre d'affaires a-t-il progressé par rapport à la saison précédente ? +10% ou plus = score max." },
                  { pct: "20%", label: "Marge", desc: "La différence entre prix de vente et prix d'achat. Une marge de 60% ou plus est excellente." },
                  { pct: "15%", label: "Rotation du stock", desc: "Combien de fois le stock se renouvelle dans l'année. 4x/an ou plus = score max." },
                  { pct: "15%", label: "Taux d'invendus", desc: "Articles restés en stock sans aucune vente depuis 12 mois. Moins il y en a, mieux c'est." },
                ].map((c) => (
                  <div key={c.label} className="rounded-lg bg-gray-50 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{c.pct}</span>
                      <span className="text-xs font-semibold text-gray-900">{c.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{c.desc}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 pt-2">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs text-gray-600"><strong>80+</strong> = Augmenter</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <span className="text-xs text-gray-600"><strong>60-79</strong> = Stable</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span className="text-xs text-gray-600"><strong>&lt;60</strong> = Réduire</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center">
            <p className="text-sm text-gray-400">Sélectionnez une saison ci-dessus pour lancer l&apos;analyse.</p>
          </div>
        </div>
      )}
    </div>
  );
}
