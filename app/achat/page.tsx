"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart,
  Bar,
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

interface Recap {
  nbModeles: number;
  qteTotale: number;
  montantAchatBrut: number;
  montantAchatNet: number;
  montantVente: number;
  remise1: number;
  remise2: number;
  remise3: number;
  coeff: number;
  marge: number;
}

interface PeriodData {
  total: { caTtc: number; caHt: number; qte: number; marge: number; prixMoyen: number };
  parGenre: { genre: string; caTtc: number; caHt: number; qte: number; marge: number; prixMoyen: number }[];
}

interface Comparatif {
  n1: PeriodData;
  n2: PeriodData;
  evolution: { caTtc: number; marge: number; qte: number; prixMoyen: number };
}

interface TauxArticle {
  artId: number;
  nom: string;
  ref: string;
  genre: string;
  couleur: string;
  rayon: string;
  famille: string;
  sousFamille: string;
  qteCommandee: number;
  qteRecue: number;
  qteVendue: number;
  tauxSortie: number;
  montantAchatNet: number;
  pxVente: number;
}

interface TauxSortieData {
  articles: TauxArticle[];
  totaux: { qteCommandee: number; qteRecue: number; qteVendue: number; tauxSortieMoyen: number };
}

interface DetailLine {
  artId: number;
  source: string;
  date: string;
  numero: string;
  article: string;
  ref: string;
  genre: string;
  couleur: string;
  taille: string;
  qte: number;
  pxNetTtc: number;
}

interface SourceTotals {
  caTtc: number;
  caHt: number;
  qte: number;
  marge: number;
  prixMoyen: number;
}

interface ComparatifDetail {
  n1: { lines: DetailLine[]; parSource: Record<string, SourceTotals> };
  n2: { lines: DetailLine[]; parSource: Record<string, SourceTotals> };
  evolutionParSource: Record<string, { caTtc: number; qte: number; marge: number }>;
}

type SourceFilter = "TOUT" | "CAISSE" | "BL/INTERNET";

// ── Helpers ────────────────────────────────────────────

function formatEuro(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
}

function formatEuroDec(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function formatPct(n: number) {
  return n.toFixed(1) + " %";
}

function formatDateFr(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function evolBadge(value: number, suffix = "%") {
  const positive = value >= 0;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
        positive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
      }`}
    >
      {positive ? "+" : ""}
      {value.toFixed(1)}
      {suffix}
    </span>
  );
}

/** Extrait l'année d'un nom de collection (ex: "PRINTEMPS ETE 2026" → 2026) */
function extractYear(colName: string): number | null {
  const match = colName.match(/\b(20\d{2})\b/);
  return match ? parseInt(match[1]) : null;
}

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// ── Composant principal ────────────────────────────────

export default function AchatPage() {
  // Filtres
  const [collections, setCollections] = useState<Collection[]>([]);
  const [marques, setMarques] = useState<string[]>([]);
  const [selectedMarque, setSelectedMarque] = useState("");
  const [targetYear, setTargetYear] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("");

  // Recherche marque
  const [marqueSearch, setMarqueSearch] = useState("");
  const [showMarqueList, setShowMarqueList] = useState(false);
  const marqueRef = useRef<HTMLDivElement>(null);

  // Périodes de comparaison (jour/mois uniquement, années dérivées)
  const [periodFromDay, setPeriodFromDay] = useState(1);
  const [periodFromMonth, setPeriodFromMonth] = useState(1);
  const [periodToDay, setPeriodToDay] = useState(new Date().getDate());
  const [periodToMonth, setPeriodToMonth] = useState(new Date().getMonth() + 1);

  // Stepper (4 étapes)
  const [step, setStep] = useState(1);

  // Données
  const [recap, setRecap] = useState<Recap | null>(null);
  const [comparatif, setComparatif] = useState<Comparatif | null>(null);
  const [tauxSortie, setTauxSortie] = useState<TauxSortieData | null>(null);

  // Comparatif detail (lazy)
  const [comparatifDetail, setComparatifDetail] = useState<ComparatifDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("TOUT");
  const [showDetail, setShowDetail] = useState(false);

  // UI
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  // Marques filtrées par recherche
  const filteredMarques = useMemo(() => {
    if (!marqueSearch) return marques;
    return marques.filter((m) => m.toLowerCase().includes(marqueSearch.toLowerCase()));
  }, [marques, marqueSearch]);

  // Clic en dehors ferme la liste
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (marqueRef.current && !marqueRef.current.contains(e.target as Node)) {
        setShowMarqueList(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Charger collections + marques
  useEffect(() => {
    Promise.all([
      fetch("/api/achat/collections").then((r) => r.json()),
      fetch("/api/filters").then((r) => r.json()),
    ])
      .then(([colData, filterData]) => {
        setCollections(colData.collections || []);
        setMarques(filterData.marques || []);
      })
      .catch(console.error)
      .finally(() => setLoadingFilters(false));
  }, []);

  // Années cibles disponibles
  const availableTargetYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear + 1; y >= currentYear - 3; y--) {
      years.push(y);
    }
    return years;
  }, []);

  // L'année d'analyse = targetYear - 1
  const analysisYear = targetYear ? parseInt(targetYear) - 1 : null;

  // Dates N et N-1 dérivées automatiquement
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const fromN1 = analysisYear ? `${analysisYear}-${pad2(periodFromMonth)}-${pad2(periodFromDay)}` : "";
  const toN1 = analysisYear ? `${analysisYear}-${pad2(periodToMonth)}-${pad2(periodToDay)}` : "";
  const fromN2 = analysisYear ? `${analysisYear - 1}-${pad2(periodFromMonth)}-${pad2(periodFromDay)}` : "";
  const toN2 = analysisYear ? `${analysisYear - 1}-${pad2(periodToMonth)}-${pad2(periodToDay)}` : "";

  // Collections filtrées sur l'année d'analyse (N-1)
  const filteredCollections = useMemo(() => {
    if (!analysisYear) return [];
    return collections.filter((c) => {
      const y = extractYear(c.COL_NOM);
      return y === analysisYear;
    });
  }, [collections, analysisYear]);

  // Quand on change l'année cible, reset collection
  useEffect(() => {
    setSelectedCollection("");
  }, [targetYear]);

  // Auto-sélection si une seule collection
  useEffect(() => {
    if (filteredCollections.length === 1) {
      setSelectedCollection(String(filteredCollections[0].COL_ID));
    }
  }, [filteredCollections]);

  // Labels des périodes pour l'affichage
  const periodLabel1 = fromN1 && toN1 ? `${formatDateFr(fromN1)} → ${formatDateFr(toN1)}` : "";
  const periodLabel2 = fromN2 && toN2 ? `${formatDateFr(fromN2)} → ${formatDateFr(toN2)}` : "";

  // Charger données
  const loadData = useCallback(async () => {
    if (!selectedCollection || !selectedMarque || !fromN1 || !toN1 || !fromN2 || !toN2) return;
    setLoadingData(true);
    setRecap(null);
    setComparatif(null);
    setTauxSortie(null);

    // Pour l'API comparatif : toN1/toN2 sont exclusifs (< date), donc on ajoute 1 jour
    const toN1Excl = addOneDay(toN1);
    const toN2Excl = addOneDay(toN2);

    try {
      const [recapRes, comparatifRes, tauxRes] = await Promise.all([
        fetch(
          `/api/achat/recap?collectionId=${selectedCollection}&marque=${encodeURIComponent(selectedMarque)}`
        ).then((r) => r.json()),
        fetch(
          `/api/achat/comparatif?marque=${encodeURIComponent(selectedMarque)}&fromN1=${fromN1}&toN1=${toN1Excl}&fromN2=${fromN2}&toN2=${toN2Excl}`
        ).then((r) => r.json()),
        fetch(
          `/api/achat/taux-sortie?collectionId=${selectedCollection}&marque=${encodeURIComponent(selectedMarque)}`
        ).then((r) => r.json()),
      ]);

      setRecap(recapRes);
      setComparatif(comparatifRes);
      setTauxSortie(tauxRes);
    } catch (error) {
      console.error("Erreur chargement données achat:", error);
    } finally {
      setLoadingData(false);
    }
  }, [selectedCollection, selectedMarque, fromN1, toN1, fromN2, toN2]);

  const loadDetail = useCallback(async () => {
    if (!selectedMarque || !fromN1 || !toN1 || !fromN2 || !toN2 || comparatifDetail) return;
    setLoadingDetail(true);
    try {
      const toN1Excl = addOneDay(toN1);
      const toN2Excl = addOneDay(toN2);
      const res = await fetch(
        `/api/achat/comparatif-detail?marque=${encodeURIComponent(selectedMarque)}&fromN1=${fromN1}&toN1=${toN1Excl}&fromN2=${fromN2}&toN2=${toN2Excl}`
      );
      const data = await res.json();
      setComparatifDetail(data);
    } catch (error) {
      console.error("Erreur chargement détail:", error);
    } finally {
      setLoadingDetail(false);
    }
  }, [selectedMarque, fromN1, toN1, fromN2, toN2, comparatifDetail]);

  useEffect(() => {
    if (step === 4) loadData();
  }, [step, loadData]);

  // Navigation
  const goToStep2 = () => { if (selectedMarque) setStep(2); };
  const goToStep3 = () => { if (selectedCollection && targetYear) setStep(3); };
  const goToStep4 = () => { if (analysisYear) setStep(4); };

  const resetWizard = () => {
    setStep(1);
    setSelectedMarque("");
    setMarqueSearch("");
    setTargetYear("");
    setSelectedCollection("");
    setPeriodFromDay(1);
    setPeriodFromMonth(1);
    setPeriodToDay(new Date().getDate());
    setPeriodToMonth(new Date().getMonth() + 1);
    setRecap(null);
    setComparatif(null);
    setTauxSortie(null);
    setComparatifDetail(null);
    setSourceFilter("TOUT");
    setShowDetail(false);
  };

  // ── Render ──

  if (loadingFilters) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  const STEPS = [
    { n: 1, label: "Marque" },
    { n: 2, label: "Collection" },
    { n: 3, label: "Périodes" },
    { n: 4, label: "Analyse" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analyse achats</h1>
        <p className="text-sm text-gray-500">
          Préparez vos achats en analysant les collections et ventes passées
        </p>
      </div>

      {/* ── Stepper visuel ── */}
      <div className="flex items-center gap-2">
        {STEPS.map(({ n, label }, i) => (
          <div key={n} className="flex items-center gap-2">
            {i > 0 && (
              <div className={`h-px w-8 ${step >= n ? "bg-indigo-400" : "bg-gray-200"}`} />
            )}
            <button
              onClick={() => { if (n < step) setStep(n); }}
              disabled={n > step}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                step === n
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                  : step > n
                  ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 cursor-pointer"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                  step === n
                    ? "bg-white/20 text-white"
                    : step > n
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-300 text-white"
                }`}
              >
                {step > n ? (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  n
                )}
              </span>
              {label}
            </button>
          </div>
        ))}

        {step > 1 && (
          <button
            onClick={resetWizard}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M20.016 4.356v4.992m0 0h-4.992m4.993 0l-3.181-3.183a8.25 8.25 0 00-13.803 3.7" />
            </svg>
            Recommencer
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          ÉTAPE 1 : Choix de la marque
          ══════════════════════════════════════════════════════ */}
      {step === 1 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-8">
            <div className="mx-auto max-w-md space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
                  <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Quelle marque analysez-vous ?</h2>
                <p className="mt-1 text-sm text-gray-500">Choisissez la marque pour laquelle vous préparez vos achats</p>
              </div>

              <div ref={marqueRef} className="relative">
                <div className="relative">
                  <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input
                    type="text"
                    value={marqueSearch}
                    onChange={(e) => {
                      setMarqueSearch(e.target.value);
                      setShowMarqueList(true);
                      if (!e.target.value) setSelectedMarque("");
                    }}
                    onFocus={() => setShowMarqueList(true)}
                    placeholder="Rechercher une marque..."
                    className="w-full rounded-lg border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  {selectedMarque && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                      {selectedMarque}
                    </span>
                  )}
                </div>
                {showMarqueList && (
                  <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {filteredMarques.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-400">Aucune marque trouvée</p>
                    ) : (
                      filteredMarques.map((m) => (
                        <button
                          key={m}
                          onClick={() => {
                            setSelectedMarque(m);
                            setMarqueSearch(m);
                            setShowMarqueList(false);
                          }}
                          className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-indigo-50 ${
                            selectedMarque === m ? "bg-indigo-50 font-semibold text-indigo-700" : "text-gray-700"
                          }`}
                        >
                          {m}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={goToStep2}
                disabled={!selectedMarque}
                className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:opacity-40 disabled:shadow-none"
              >
                Continuer
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════
          ÉTAPE 2 : Année cible + Collection
          ══════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">
              {selectedMarque}
            </span>
          </div>

          <Card className="border-0 shadow-sm">
            <CardContent className="py-8">
              <div className="mx-auto max-w-md space-y-6">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
                    <svg className="h-6 w-6 text-violet-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Pour quelle saison achetez-vous ?</h2>
                  <p className="mt-1 text-sm text-gray-500">Indiquez l&apos;année de la saison que vous préparez</p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {availableTargetYears.map((y) => (
                    <button
                      key={y}
                      onClick={() => setTargetYear(String(y))}
                      className={`rounded-lg border-2 px-4 py-3 text-sm font-bold transition-all ${
                        targetYear === String(y)
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md shadow-indigo-100"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>

                {targetYear && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex gap-3">
                      <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                      </svg>
                      <div>
                        <p className="text-sm font-semibold text-amber-800">
                          Achats {targetYear} = analyse de la collection {analysisYear}
                        </p>
                        <p className="mt-1 text-xs text-amber-700">
                          Pour préparer vos achats <strong>{targetYear}</strong>, nous analysons les
                          commandes et ventes de la collection <strong>{analysisYear}</strong> (saison
                          équivalente N-1).
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {targetYear && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Collection {analysisYear} à analyser
                    </label>
                    {filteredCollections.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-center text-sm text-gray-400">
                        Aucune collection trouvée pour {analysisYear}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {filteredCollections.map((c) => (
                          <button
                            key={c.COL_ID}
                            onClick={() => setSelectedCollection(String(c.COL_ID))}
                            className={`w-full rounded-lg border-2 px-4 py-3 text-left text-sm font-medium transition-all ${
                              selectedCollection === String(c.COL_ID)
                                ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md shadow-indigo-100"
                                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            {c.COL_NOM}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {targetYear && (
                  <button
                    onClick={goToStep3}
                    disabled={!selectedCollection}
                    className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:opacity-40 disabled:shadow-none"
                  >
                    Continuer
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ÉTAPE 3 : Périodes de comparaison
          ══════════════════════════════════════════════════════ */}
      {step === 3 && analysisYear && (
        <div className="space-y-4">
          {/* Récap sélections */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">
              {selectedMarque}
            </span>
            <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-700">
              Achats {targetYear}
            </span>
            <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
              {collections.find((c) => String(c.COL_ID) === selectedCollection)?.COL_NOM}
            </span>
          </div>

          <Card className="border-0 shadow-sm">
            <CardContent className="py-8">
              <div className="mx-auto max-w-lg space-y-6">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                    <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Période de comparaison</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Choisissez un jour et un mois, la comparaison {analysisYear} vs {analysisYear! - 1} sera automatique
                  </p>
                </div>

                {/* Sélecteurs Du / Au */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-gray-400">Du</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={periodFromDay}
                        onChange={(e) => setPeriodFromDay(Math.max(1, Math.min(31, Number(e.target.value) || 1)))}
                        className="w-16 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-center text-sm font-semibold text-gray-700 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                      <select
                        value={periodFromMonth}
                        onChange={(e) => setPeriodFromMonth(Number(e.target.value))}
                        className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        {MONTHS.map((m, i) => (
                          <option key={i} value={i + 1}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-gray-400">Au</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={periodToDay}
                        onChange={(e) => setPeriodToDay(Math.max(1, Math.min(31, Number(e.target.value) || 1)))}
                        className="w-16 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-center text-sm font-semibold text-gray-700 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                      <select
                        value={periodToMonth}
                        onChange={(e) => setPeriodToMonth(Number(e.target.value))}
                        className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        {MONTHS.map((m, i) => (
                          <option key={i} value={i + 1}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Prévisualisation des périodes */}
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 text-center">
                      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">N ({analysisYear})</p>
                      <p className="mt-1 text-sm font-medium text-gray-700">
                        {periodFromDay} {MONTHS[periodFromMonth - 1]} &rarr; {periodToDay} {MONTHS[periodToMonth - 1]} {analysisYear}
                      </p>
                    </div>
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-bold text-gray-400">VS</span>
                    <div className="flex-1 text-center">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">N-1 ({analysisYear! - 1})</p>
                      <p className="mt-1 text-sm font-medium text-gray-500">
                        {periodFromDay} {MONTHS[periodFromMonth - 1]} &rarr; {periodToDay} {MONTHS[periodToMonth - 1]} {analysisYear! - 1}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={goToStep4}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700"
                >
                  Lancer l&apos;analyse
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ÉTAPE 4 : Résultats
          ══════════════════════════════════════════════════════ */}
      {step === 4 && (
        <div className="space-y-6">
          {/* Récap sélection */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">
              {selectedMarque}
            </span>
            <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-700">
              Achats {targetYear}
            </span>
            <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
              {collections.find((c) => String(c.COL_ID) === selectedCollection)?.COL_NOM}
            </span>
            <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              {periodLabel1}
            </span>
            <span className="text-xs text-gray-400">vs</span>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              {periodLabel2}
            </span>
          </div>

          {loadingData ? (
            <div className="flex items-center justify-center py-16">
              <div className="space-y-3 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                <p className="text-sm text-gray-500">Chargement des données...</p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Section 1 : Récap commande ── */}
              {recap && (
                <div>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
                    Récap commande &mdash; {collections.find((c) => String(c.COL_ID) === selectedCollection)?.COL_NOM}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-200">
                      <CardContent className="pt-5 pb-4">
                        <p className="text-sm font-medium text-indigo-100">Modèles commandés</p>
                        <p className="mt-1 text-3xl font-bold tracking-tight">{recap.nbModeles}</p>
                        <p className="mt-1 text-xs text-indigo-200">{recap.qteTotale} pièces</p>
                        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                      </CardContent>
                    </Card>
                    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-200">
                      <CardContent className="pt-5 pb-4">
                        <p className="text-sm font-medium text-violet-100">Montant achat net</p>
                        <p className="mt-1 text-3xl font-bold tracking-tight">{formatEuro(recap.montantAchatNet)}</p>
                        <p className="mt-1 text-xs text-violet-200">Brut : {formatEuro(recap.montantAchatBrut)}</p>
                        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                      </CardContent>
                    </Card>
                    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-fuchsia-500 to-fuchsia-600 text-white shadow-lg shadow-fuchsia-200">
                      <CardContent className="pt-5 pb-4">
                        <p className="text-sm font-medium text-fuchsia-100">Montant vente</p>
                        <p className="mt-1 text-3xl font-bold tracking-tight">{formatEuro(recap.montantVente)}</p>
                        <p className="mt-1 text-xs text-fuchsia-200">Coeff : {recap.coeff.toFixed(2)}</p>
                        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                      </CardContent>
                    </Card>
                    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-200">
                      <CardContent className="pt-5 pb-4">
                        <p className="text-sm font-medium text-emerald-100">Marge</p>
                        <p className="mt-1 text-3xl font-bold tracking-tight">{formatPct(recap.marge)}</p>
                        <p className="mt-1 text-xs text-emerald-200">
                          Remise totale : {formatPct(recap.remise1 + recap.remise2 + recap.remise3)}
                        </p>
                        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                      </CardContent>
                    </Card>
                  </div>

                  {(recap.remise1 > 0 || recap.remise2 > 0 || recap.remise3 > 0) && (
                    <div className="mt-3 flex gap-3">
                      {recap.remise1 > 0 && (
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                          Remise 1 : {formatPct(recap.remise1)}
                        </span>
                      )}
                      {recap.remise2 > 0 && (
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                          Remise 2 : {formatPct(recap.remise2)}
                        </span>
                      )}
                      {recap.remise3 > 0 && (
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                          Remise 3 : {formatPct(recap.remise3)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Section 2 : Comparatif ventes (caisse + internet) ── */}
              {comparatif && (
                <div>
                  <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-gray-400">
                    Comparatif ventes &mdash; {selectedMarque}
                  </h2>
                  <p className="mb-3 text-xs text-gray-400">
                    Tous produits, toutes collections confondus &bull; {periodLabel1} vs {periodLabel2}
                  </p>

                  {/* Onglets source : Tout / Caisse / Web */}
                  <div className="mb-4 flex gap-1">
                    {([["TOUT", "Tout"], ["CAISSE", "Caisse"], ["BL/INTERNET", "Web"]] as [SourceFilter, string][]).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => {
                          setSourceFilter(key);
                          if (key !== "TOUT" && !comparatifDetail) loadDetail();
                        }}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                          sourceFilter === key
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                    {loadingDetail && (
                      <div className="ml-2 flex items-center gap-2 text-xs text-gray-400">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                        Chargement...
                      </div>
                    )}
                  </div>

                  {/* Tableau comparatif N vs N-1 */}
                  <Card className="mb-4 border-0 shadow-sm">
                    <CardContent className="pt-6">
                      {/* Mode TOUT : données agrégées existantes */}
                      {sourceFilter === "TOUT" && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                                <th className="pb-3 pr-4 font-medium"></th>
                                <th className="pb-3 pr-4 text-right font-medium">{analysisYear}</th>
                                <th className="pb-3 pr-4 text-right font-medium">{analysisYear! - 1}</th>
                                <th className="pb-3 text-right font-medium">Evol.</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-t border-gray-100">
                                <td className="py-3 pr-4 font-medium text-gray-900">CA TTC</td>
                                <td className="py-3 pr-4 text-right tabular-nums font-semibold text-gray-900">{formatEuro(comparatif.n1.total.caTtc)}</td>
                                <td className="py-3 pr-4 text-right tabular-nums text-gray-500">{formatEuro(comparatif.n2.total.caTtc)}</td>
                                <td className="py-3 text-right">{evolBadge(comparatif.evolution.caTtc)}</td>
                              </tr>
                              <tr className="border-t border-gray-100">
                                <td className="py-3 pr-4 font-medium text-gray-900">Quantité vendue</td>
                                <td className="py-3 pr-4 text-right tabular-nums font-semibold text-gray-900">{comparatif.n1.total.qte.toLocaleString("fr-FR")}</td>
                                <td className="py-3 pr-4 text-right tabular-nums text-gray-500">{comparatif.n2.total.qte.toLocaleString("fr-FR")}</td>
                                <td className="py-3 text-right">{evolBadge(comparatif.evolution.qte)}</td>
                              </tr>
                              <tr className="border-t border-gray-100">
                                <td className="py-3 pr-4 font-medium text-gray-900">Marge</td>
                                <td className="py-3 pr-4 text-right tabular-nums font-semibold text-gray-900">{formatPct(comparatif.n1.total.marge)}</td>
                                <td className="py-3 pr-4 text-right tabular-nums text-gray-500">{formatPct(comparatif.n2.total.marge)}</td>
                                <td className="py-3 text-right">{evolBadge(comparatif.evolution.marge, " pts")}</td>
                              </tr>
                              <tr className="border-t border-gray-100">
                                <td className="py-3 pr-4 font-medium text-gray-900">Prix moyen de vente</td>
                                <td className="py-3 pr-4 text-right tabular-nums font-semibold text-gray-900">{formatEuroDec(comparatif.n1.total.prixMoyen)}</td>
                                <td className="py-3 pr-4 text-right tabular-nums text-gray-500">{formatEuroDec(comparatif.n2.total.prixMoyen)}</td>
                                <td className="py-3 text-right">{evolBadge(comparatif.evolution.prixMoyen)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Mode Caisse ou Web : données par source */}
                      {sourceFilter !== "TOUT" && comparatifDetail && (() => {
                        const s1 = comparatifDetail.n1.parSource[sourceFilter] || { caTtc: 0, caHt: 0, qte: 0, marge: 0, prixMoyen: 0 };
                        const s2 = comparatifDetail.n2.parSource[sourceFilter] || { caTtc: 0, caHt: 0, qte: 0, marge: 0, prixMoyen: 0 };
                        const ev = comparatifDetail.evolutionParSource[sourceFilter] || { caTtc: 0, qte: 0, marge: 0 };
                        const evolPm = s2.prixMoyen !== 0 ? ((s1.prixMoyen - s2.prixMoyen) / Math.abs(s2.prixMoyen)) * 100 : 0;
                        return (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                                  <th className="pb-3 pr-4 font-medium">
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${sourceFilter === "CAISSE" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                                      {sourceFilter === "CAISSE" ? "Caisse" : "Web"}
                                    </span>
                                  </th>
                                  <th className="pb-3 pr-4 text-right font-medium">{analysisYear}</th>
                                  <th className="pb-3 pr-4 text-right font-medium">{analysisYear! - 1}</th>
                                  <th className="pb-3 text-right font-medium">Evol.</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-t border-gray-100">
                                  <td className="py-3 pr-4 font-medium text-gray-900">CA TTC</td>
                                  <td className="py-3 pr-4 text-right tabular-nums font-semibold text-gray-900">{formatEuro(s1.caTtc)}</td>
                                  <td className="py-3 pr-4 text-right tabular-nums text-gray-500">{formatEuro(s2.caTtc)}</td>
                                  <td className="py-3 text-right">{evolBadge(ev.caTtc)}</td>
                                </tr>
                                <tr className="border-t border-gray-100">
                                  <td className="py-3 pr-4 font-medium text-gray-900">Quantité vendue</td>
                                  <td className="py-3 pr-4 text-right tabular-nums font-semibold text-gray-900">{s1.qte.toLocaleString("fr-FR")}</td>
                                  <td className="py-3 pr-4 text-right tabular-nums text-gray-500">{s2.qte.toLocaleString("fr-FR")}</td>
                                  <td className="py-3 text-right">{evolBadge(ev.qte)}</td>
                                </tr>
                                <tr className="border-t border-gray-100">
                                  <td className="py-3 pr-4 font-medium text-gray-900">Marge</td>
                                  <td className="py-3 pr-4 text-right tabular-nums font-semibold text-gray-900">{formatPct(s1.marge)}</td>
                                  <td className="py-3 pr-4 text-right tabular-nums text-gray-500">{formatPct(s2.marge)}</td>
                                  <td className="py-3 text-right">{evolBadge(ev.marge, " pts")}</td>
                                </tr>
                                <tr className="border-t border-gray-100">
                                  <td className="py-3 pr-4 font-medium text-gray-900">Prix moyen de vente</td>
                                  <td className="py-3 pr-4 text-right tabular-nums font-semibold text-gray-900">{formatEuroDec(s1.prixMoyen)}</td>
                                  <td className="py-3 pr-4 text-right tabular-nums text-gray-500">{formatEuroDec(s2.prixMoyen)}</td>
                                  <td className="py-3 text-right">{evolBadge(evolPm)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}

                      {sourceFilter !== "TOUT" && !comparatifDetail && !loadingDetail && (
                        <p className="py-4 text-center text-sm text-gray-400">Aucune donnée disponible</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Graphique par genre */}
                  {comparatif.n1.parGenre.length > 0 && sourceFilter === "TOUT" && (
                    <Card className="border-0 shadow-sm">
                      <CardContent className="pt-6">
                        <h3 className="mb-4 text-sm font-semibold text-gray-700">CA par genre &mdash; comparatif</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart
                            data={comparatif.n1.parGenre.map((g) => {
                              const n2Genre = comparatif.n2.parGenre.find((g2) => g2.genre === g.genre);
                              return {
                                genre: g.genre,
                                [`${analysisYear}`]: g.caTtc,
                                [`${analysisYear! - 1}`]: n2Genre?.caTtc || 0,
                              };
                            })}
                            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="genre" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                            <YAxis
                              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k€` : `${v}€`)}
                              tick={{ fontSize: 11, fill: "#94a3b8" }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              formatter={(value) => [formatEuro(Number(value)), ""]}
                              contentStyle={{
                                borderRadius: 12,
                                border: "1px solid #e2e8f0",
                                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                              }}
                            />
                            <Legend />
                            <Bar dataKey={String(analysisYear! - 1)} fill="#c7d2fe" radius={[4, 4, 0, 0]} barSize={28} />
                            <Bar dataKey={String(analysisYear!)} fill="#6366f1" radius={[4, 4, 0, 0]} barSize={28} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  {/* Tableau détaillé par genre */}
                  {sourceFilter === "TOUT" && (
                    <Card className="mt-4 border-0 shadow-sm">
                      <CardContent className="pt-6">
                        <h3 className="mb-4 text-sm font-semibold text-gray-700">Détail par genre</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                                <th className="pb-3 pr-4 font-medium">Genre</th>
                                <th className="pb-3 pr-4 text-right font-medium">CA {analysisYear}</th>
                                <th className="pb-3 pr-4 text-right font-medium">CA {analysisYear! - 1}</th>
                                <th className="pb-3 pr-4 text-right font-medium">Evol.</th>
                                <th className="pb-3 pr-4 text-right font-medium">Qté {analysisYear}</th>
                                <th className="pb-3 text-right font-medium">Px moyen</th>
                              </tr>
                            </thead>
                            <tbody>
                              {comparatif.n1.parGenre.map((g) => {
                                const n2 = comparatif.n2.parGenre.find((g2) => g2.genre === g.genre);
                                const n2Ca = n2?.caTtc || 0;
                                const evol = n2Ca > 0 ? ((g.caTtc - n2Ca) / n2Ca) * 100 : 0;
                                return (
                                  <tr key={g.genre} className="border-t border-gray-100 hover:bg-gray-50/50">
                                    <td className="py-2.5 pr-4 font-medium text-gray-900">{g.genre}</td>
                                    <td className="py-2.5 pr-4 text-right tabular-nums font-semibold text-gray-900">{formatEuro(g.caTtc)}</td>
                                    <td className="py-2.5 pr-4 text-right tabular-nums text-gray-500">{formatEuro(n2Ca)}</td>
                                    <td className="py-2.5 pr-4 text-right">{evolBadge(evol)}</td>
                                    <td className="py-2.5 pr-4 text-right tabular-nums text-gray-600">{g.qte.toLocaleString("fr-FR")}</td>
                                    <td className="py-2.5 text-right tabular-nums text-gray-600">{formatEuroDec(g.prixMoyen)}</td>
                                  </tr>
                                );
                              })}
                              <tr className="border-t-2 border-gray-200 bg-gray-50/50 font-semibold">
                                <td className="py-2.5 pr-4 text-gray-900">Total</td>
                                <td className="py-2.5 pr-4 text-right tabular-nums text-gray-900">{formatEuro(comparatif.n1.total.caTtc)}</td>
                                <td className="py-2.5 pr-4 text-right tabular-nums text-gray-500">{formatEuro(comparatif.n2.total.caTtc)}</td>
                                <td className="py-2.5 pr-4 text-right">{evolBadge(comparatif.evolution.caTtc)}</td>
                                <td className="py-2.5 pr-4 text-right tabular-nums text-gray-600">{comparatif.n1.total.qte.toLocaleString("fr-FR")}</td>
                                <td className="py-2.5 text-right tabular-nums text-gray-600">{formatEuroDec(comparatif.n1.total.prixMoyen)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Boutons détail + export */}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      onClick={() => {
                        if (!comparatifDetail) loadDetail();
                        setShowDetail(!showDetail);
                      }}
                      className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-200"
                    >
                      <svg className={`h-4 w-4 transition-transform ${showDetail ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                      {showDetail ? "Masquer le détail" : "Voir le détail des ventes"}
                    </button>
                    <a
                      href={`/api/achat/export-detail?marque=${encodeURIComponent(selectedMarque)}&fromN1=${fromN1}&toN1=${addOneDay(toN1)}&fromN2=${fromN2}&toN2=${addOneDay(toN2)}`}
                      className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 transition-all hover:bg-emerald-100"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Télécharger Excel
                    </a>
                  </div>

                  {/* Tableau détail dépliable */}
                  {showDetail && (
                    <Card className="mt-4 border-0 shadow-sm">
                      <CardContent className="pt-6">
                        {loadingDetail ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                            <span className="ml-3 text-sm text-gray-400">Chargement du détail...</span>
                          </div>
                        ) : comparatifDetail ? (() => {
                          const filterFn = (l: DetailLine) =>
                            sourceFilter === "TOUT" ? true : l.source === sourceFilter;
                          const n1Lines = comparatifDetail.n1.lines.filter(filterFn);
                          const n2Lines = comparatifDetail.n2.lines.filter(filterFn);
                          const allLines = [
                            ...n1Lines.map((l) => ({ ...l, periode: `N (${analysisYear})` })),
                            ...n2Lines.map((l) => ({ ...l, periode: `N-1 (${analysisYear! - 1})` })),
                          ];
                          return (
                            <div>
                              <h3 className="mb-3 text-sm font-semibold text-gray-700">
                                Détail des ventes ({n1Lines.length} + {n2Lines.length} lignes)
                                {sourceFilter !== "TOUT" && (
                                  <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${sourceFilter === "CAISSE" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                                    {sourceFilter === "CAISSE" ? "Caisse" : "Web"}
                                  </span>
                                )}
                              </h3>
                              <div className="max-h-[500px] overflow-auto rounded-lg border border-gray-100">
                                <table className="w-full text-sm">
                                  <thead className="sticky top-0 bg-white shadow-[0_1px_0_0_#e5e7eb]">
                                    <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                                      <th className="px-3 py-2.5 font-medium">Période</th>
                                      <th className="px-3 py-2.5 font-medium">Date</th>
                                      <th className="px-3 py-2.5 font-medium">Source</th>
                                      <th className="px-3 py-2.5 font-medium">Article</th>
                                      <th className="px-3 py-2.5 font-medium">Réf</th>
                                      <th className="px-3 py-2.5 font-medium">Couleur</th>
                                      <th className="px-3 py-2.5 font-medium">Taille</th>
                                      <th className="px-3 py-2.5 text-right font-medium">Qté</th>
                                      <th className="px-3 py-2.5 text-right font-medium">PX Net TTC</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {allLines.map((l, i) => (
                                      <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/50">
                                        <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{l.periode}</td>
                                        <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-600">
                                          {l.date ? formatDateFr(l.date) : ""}
                                        </td>
                                        <td className="px-3 py-2">
                                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                            l.source === "CAISSE" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                                          }`}>
                                            {l.source === "CAISSE" ? "Caisse" : "Web"}
                                          </span>
                                        </td>
                                        <td className="max-w-[180px] truncate px-3 py-2 text-xs font-medium">
                                          <a href={`/articles/${l.artId}`} className="text-indigo-600 hover:text-indigo-800 hover:underline">{l.article}</a>
                                        </td>
                                        <td className="px-3 py-2 text-xs text-gray-500">{l.ref}</td>
                                        <td className="px-3 py-2 text-xs text-gray-500">{l.couleur || "—"}</td>
                                        <td className="px-3 py-2 text-xs text-gray-500">{l.taille || "—"}</td>
                                        <td className="px-3 py-2 text-right tabular-nums text-xs font-semibold text-gray-900">{l.qte}</td>
                                        <td className="px-3 py-2 text-right tabular-nums text-xs text-gray-700">{formatEuroDec(l.pxNetTtc)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })() : null}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* ── Section 3 : Taux de sortie ── */}
              {tauxSortie && (
                <div>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
                    Taux de sortie
                  </h2>

                  <div className="mb-4 grid gap-4 sm:grid-cols-4">
                    <Card className="border-0 shadow-sm">
                      <CardContent className="pt-4 pb-3">
                        <p className="text-xs font-medium text-gray-400">Qté commandée</p>
                        <p className="mt-1 text-xl font-bold text-gray-900">{tauxSortie.totaux.qteCommandee.toLocaleString("fr-FR")}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm">
                      <CardContent className="pt-4 pb-3">
                        <p className="text-xs font-medium text-gray-400">Qté reçue</p>
                        <p className="mt-1 text-xl font-bold text-gray-900">{tauxSortie.totaux.qteRecue.toLocaleString("fr-FR")}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm">
                      <CardContent className="pt-4 pb-3">
                        <p className="text-xs font-medium text-gray-400">Qté vendue</p>
                        <p className="mt-1 text-xl font-bold text-gray-900">{tauxSortie.totaux.qteVendue.toLocaleString("fr-FR")}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm">
                      <CardContent className="pt-4 pb-3">
                        <p className="text-xs font-medium text-gray-400">Taux de sortie moyen</p>
                        <p className="mt-1 text-xl font-bold text-gray-900">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-base font-bold ${
                              tauxSortie.totaux.tauxSortieMoyen >= 70
                                ? "bg-emerald-50 text-emerald-700"
                                : tauxSortie.totaux.tauxSortieMoyen >= 40
                                ? "bg-amber-50 text-amber-700"
                                : "bg-red-50 text-red-600"
                            }`}
                          >
                            {formatPct(tauxSortie.totaux.tauxSortieMoyen)}
                          </span>
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-0 shadow-sm">
                    <CardContent className="pt-6">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-700">
                          Détail par article ({tauxSortie.articles.length})
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                              <th className="pb-3 pr-3 font-medium">Article</th>
                              <th className="pb-3 pr-3 font-medium">Réf.</th>
                              <th className="pb-3 pr-3 font-medium">Genre</th>
                              <th className="pb-3 pr-3 font-medium">Couleur</th>
                              <th className="pb-3 pr-3 font-medium">Rayon / Famille</th>
                              <th className="pb-3 pr-3 text-right font-medium">Commandé</th>
                              <th className="pb-3 pr-3 text-right font-medium">Reçu</th>
                              <th className="pb-3 pr-3 text-right font-medium">Vendu</th>
                              <th className="pb-3 pr-3 text-right font-medium">Taux sortie</th>
                              <th className="pb-3 pr-3 text-right font-medium">PA net</th>
                              <th className="pb-3 text-right font-medium">PV</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tauxSortie.articles.map((a, idx) => (
                              <tr key={`${a.artId}-${a.couleur}-${idx}`} className="border-t border-gray-100 hover:bg-gray-50/50">
                                <td className="max-w-[200px] truncate py-2.5 pr-3 font-medium">
                                  <a href={`/articles/${a.artId}`} className="text-indigo-600 hover:text-indigo-800 hover:underline">{a.nom}</a>
                                </td>
                                <td className="py-2.5 pr-3 text-xs text-gray-500">{a.ref}</td>
                                <td className="py-2.5 pr-3 text-xs text-gray-500">{a.genre || "—"}</td>
                                <td className="py-2.5 pr-3 text-xs text-gray-500">{a.couleur || "—"}</td>
                                <td className="py-2.5 pr-3 text-xs text-gray-500">
                                  {[a.rayon, a.famille].filter(Boolean).join(" / ") || "—"}
                                </td>
                                <td className="py-2.5 pr-3 text-right tabular-nums font-semibold text-gray-900">{a.qteCommandee}</td>
                                <td className="py-2.5 pr-3 text-right tabular-nums text-gray-600">{a.qteRecue}</td>
                                <td className="py-2.5 pr-3 text-right tabular-nums text-gray-600">{a.qteVendue}</td>
                                <td className="py-2.5 pr-3 text-right">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                      a.tauxSortie >= 70
                                        ? "bg-emerald-50 text-emerald-700"
                                        : a.tauxSortie >= 40
                                        ? "bg-amber-50 text-amber-700"
                                        : "bg-red-50 text-red-600"
                                    }`}
                                  >
                                    {formatPct(a.tauxSortie)}
                                  </span>
                                </td>
                                <td className="py-2.5 pr-3 text-right tabular-nums text-gray-600">{formatEuroDec(a.montantAchatNet)}</td>
                                <td className="py-2.5 text-right tabular-nums text-gray-600">{formatEuroDec(a.pxVente)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Ajoute 1 jour à une date YYYY-MM-DD (pour borne exclusive) */
function addOneDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}
