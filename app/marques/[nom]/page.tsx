"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ── Types ───────────────────────────────────────────────

interface BrandStats {
  nbArticles: number;
  totalQte: number;
  totalValor: number;
  pump: number;
}

interface BrandArticle {
  ART_ID: number;
  ART_NOM: string;
  ART_REFMRK: string;
  REF_GINKOIA: string;
  RAYON: string;
  FAMILLE: string;
  GENRE: string;
  SAISON: string;
  STOCK: number;
}

interface Vente {
  SOURCE: string;
  DATE_VENTE: string;
  NUMERO: string;
  ART_NOM: string;
  ART_ID: number;
  COULEUR: string;
  TAILLE: string;
  QTE: number;
  PXBRUT: number;
  REMISE: number;
  PXNET: number;
}

interface PeriodData {
  total: { caTtc: number; caHt: number; qte: number; marge: number; prixMoyen: number };
  parGenre: { genre: string; caTtc: number; caHt: number; qte: number; marge: number; prixMoyen: number }[];
}

interface Performance {
  anneeN: number;
  anneeN1: number;
  n: PeriodData;
  n1: PeriodData;
  evolution: { caTtc: number; qte: number; prixMoyen: number };
}

// ── Helpers ─────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("fr-FR");
}

function formatEuro(n: number | null) {
  if (n == null) return "-";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " \u20ac";
}

function formatPct(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

// ── Component ───────────────────────────────────────────

export default function MarquePage({
  params,
}: {
  params: Promise<{ nom: string }>;
}) {
  const { nom } = use(params);
  const marque = decodeURIComponent(nom);

  const [stats, setStats] = useState<BrandStats | null>(null);
  const [articles, setArticles] = useState<BrandArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState("articles");

  // Ventes (lazy)
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [ventesLoading, setVentesLoading] = useState(false);
  const [ventesFetched, setVentesFetched] = useState(false);

  // Performance (lazy)
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfFetched, setPerfFetched] = useState(false);

  // Initial load: stats + articles
  useEffect(() => {
    fetch(`/api/marques/${encodeURIComponent(marque)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Marque non trouvée");
        return r.json();
      })
      .then((data) => {
        setStats(data.stats);
        setArticles(data.articles);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [marque]);

  // Lazy-load tabs
  useEffect(() => {
    if (activeTab === "ventes" && !ventesFetched && !ventesLoading) {
      setVentesLoading(true);
      fetch(`/api/marques/${encodeURIComponent(marque)}/ventes`)
        .then((r) => r.json())
        .then(setVentes)
        .catch(console.error)
        .finally(() => { setVentesLoading(false); setVentesFetched(true); });
    }
    if (activeTab === "performance" && !perfFetched && !perfLoading) {
      setPerfLoading(true);
      fetch(`/api/marques/${encodeURIComponent(marque)}/performance`)
        .then((r) => r.json())
        .then(setPerformance)
        .catch(console.error)
        .finally(() => { setPerfLoading(false); setPerfFetched(true); });
    }
  }, [activeTab, marque, ventesFetched, ventesLoading, perfFetched, perfLoading]);

  // ── Loading / Error ───────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm text-gray-500">Chargement de la marque...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/articles" className="text-sm text-indigo-600 hover:underline">
          &larr; Retour aux articles
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  // ── Chart data ────────────────────────────────────────

  const chartData = performance
    ? (() => {
        const genres = new Set<string>();
        performance.n.parGenre.forEach((g) => genres.add(g.genre));
        performance.n1.parGenre.forEach((g) => genres.add(g.genre));
        return Array.from(genres).map((genre) => {
          const nRow = performance.n.parGenre.find((g) => g.genre === genre);
          const n1Row = performance.n1.parGenre.find((g) => g.genre === genre);
          return {
            genre,
            [`CA ${performance.anneeN}`]: Math.round(nRow?.caTtc || 0),
            [`CA ${performance.anneeN1}`]: Math.round(n1Row?.caTtc || 0),
          };
        });
      })()
    : [];

  // ── Render ────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/articles"
        className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Retour aux articles
      </Link>

      {/* ===== BRAND TITLE ===== */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm px-6 py-5">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{marque}</h1>
      </div>

      {/* ===== STATS ROW ===== */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 flex-shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">Articles</p>
              <p className="text-2xl font-bold text-indigo-600">{stats?.nbArticles ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 flex-shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">Stock</p>
              <p className={`text-2xl font-bold ${(stats?.totalQte ?? 0) > 0 ? "text-emerald-600" : "text-gray-300"}`}>
                {stats?.totalQte ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 flex-shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">Valorisation</p>
              <p className="text-lg font-bold text-gray-900">{formatEuro(stats?.totalValor ?? 0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600 flex-shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">PUMP moyen</p>
              <p className="text-lg font-bold text-gray-900">{formatEuro(stats?.pump ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== TABS ===== */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100/80">
          <TabsTrigger value="articles" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Articles
          </TabsTrigger>
          <TabsTrigger value="ventes" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            {"Ventes récentes"}
          </TabsTrigger>
          <TabsTrigger value="performance" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Performance
          </TabsTrigger>
        </TabsList>

        {/* ── Tab Articles ──────────────────────────────── */}
        <TabsContent value="articles" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              {articles.length === 0 ? (
                <p className="py-8 text-center text-gray-400">{"Aucun article en stock."}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-100">
                        <TableHead className="text-xs uppercase tracking-wider text-gray-400">Nom</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-gray-400">{"Réf"}</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-gray-400">Rayon</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-gray-400">Famille</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-gray-400">Genre</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-gray-400">Saison</TableHead>
                        <TableHead className="text-right text-xs uppercase tracking-wider text-gray-400">Stock</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {articles.map((a) => (
                        <TableRow key={a.ART_ID} className="border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <TableCell>
                            <Link
                              href={`/articles/${a.ART_ID}`}
                              className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                            >
                              {a.ART_NOM}
                            </Link>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-gray-500">{a.ART_REFMRK || "-"}</TableCell>
                          <TableCell className="text-sm">{a.RAYON || "-"}</TableCell>
                          <TableCell className="text-sm">{a.FAMILLE || "-"}</TableCell>
                          <TableCell className="text-sm">{a.GENRE || "-"}</TableCell>
                          <TableCell className="text-sm text-gray-500">{a.SAISON || "-"}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            <span className={a.STOCK > 0 ? "text-emerald-600" : "text-gray-300"}>
                              {a.STOCK}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400">
                    {articles.length} article{articles.length > 1 ? "s" : ""} en stock
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab Ventes ────────────────────────────────── */}
        <TabsContent value="ventes" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              {ventesLoading ? (
                <div className="py-10 text-center">
                  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                </div>
              ) : ventes.length === 0 ? (
                <p className="py-8 text-center text-gray-400">{"Aucune vente trouvée."}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-100">
                        <TableHead className="text-xs uppercase tracking-wider text-gray-400">Date</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-gray-400">Source</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-gray-400">{"N°"}</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-gray-400">Article</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-gray-400">Couleur</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-gray-400">Taille</TableHead>
                        <TableHead className="text-right text-xs uppercase tracking-wider text-gray-400">{"Qté"}</TableHead>
                        <TableHead className="text-right text-xs uppercase tracking-wider text-gray-400">Prix brut</TableHead>
                        <TableHead className="text-right text-xs uppercase tracking-wider text-gray-400">Remise</TableHead>
                        <TableHead className="text-right text-xs uppercase tracking-wider text-gray-400">Prix net</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ventes.map((v, i) => (
                        <TableRow key={i} className="border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <TableCell className="text-sm">{formatDate(v.DATE_VENTE)}</TableCell>
                          <TableCell>
                            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                              v.SOURCE === "CAISSE"
                                ? "bg-blue-100 text-blue-700"
                                : v.SOURCE === "WEB"
                                ? "bg-green-100 text-green-700"
                                : "bg-purple-100 text-purple-700"
                            }`}>
                              {v.SOURCE}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-gray-500">{v.NUMERO}</TableCell>
                          <TableCell>
                            <Link
                              href={`/articles/${v.ART_ID}`}
                              className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
                            >
                              {v.ART_NOM}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {v.COULEUR ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-indigo-400" />
                                <span className="text-sm">{v.COULEUR}</span>
                              </span>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-sm">{v.TAILLE || "-"}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{v.QTE}</TableCell>
                          <TableCell className="text-right tabular-nums text-gray-500">{formatEuro(v.PXBRUT)}</TableCell>
                          <TableCell className="text-right">
                            {v.REMISE ? (
                              <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700">
                                -{v.REMISE}%
                              </span>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold text-gray-900">{formatEuro(v.PXNET)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-400">
                    <span>{ventes.length} vente{ventes.length > 1 ? "s" : ""}</span>
                    <span className="font-medium text-gray-600">
                      {"Total : "}{formatEuro(ventes.reduce((s, v) => s + (v.PXNET || 0), 0))}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab Performance ───────────────────────────── */}
        <TabsContent value="performance" className="mt-4">
          <div className="space-y-4">
            {perfLoading ? (
              <div className="py-10 text-center">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
              </div>
            ) : !performance ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-8 text-center text-gray-400">
                  {"Aucune donnée de performance."}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Evolution cards */}
                <div className="grid gap-4 grid-cols-3">
                  {[
                    { label: "CA TTC", value: formatEuro(performance.n.total.caTtc), evol: performance.evolution.caTtc },
                    { label: "Quantité", value: String(Math.round(performance.n.total.qte)), evol: performance.evolution.qte },
                    { label: "Prix moyen", value: formatEuro(performance.n.total.prixMoyen), evol: performance.evolution.prixMoyen },
                  ].map((item) => (
                    <Card key={item.label} className="border-0 shadow-sm">
                      <CardContent className="pt-5 pb-4 text-center">
                        <p className="text-xs font-medium text-gray-400">{item.label} {performance.anneeN}</p>
                        <p className="text-xl font-bold text-gray-900 mt-1">{item.value}</p>
                        <p className={`text-sm font-semibold mt-1 ${
                          item.evol > 0
                            ? "text-emerald-600"
                            : item.evol < 0
                            ? "text-red-600"
                            : "text-gray-400"
                        }`}>
                          {formatPct(item.evol)} vs {performance.anneeN1}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Bar chart N vs N-1 by genre */}
                {chartData.length > 0 && (
                  <Card className="border-0 shadow-sm">
                    <CardContent className="pt-6">
                      <h3 className="text-sm font-semibold text-gray-700 mb-4">
                        CA par genre : {performance.anneeN} vs {performance.anneeN1}
                      </h3>
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="genre" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                          <Tooltip
                            formatter={(value) => formatEuro(Number(value))}
                            contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                          />
                          <Legend />
                          <Bar dataKey={`CA ${performance.anneeN}`} fill="#6366f1" radius={[4, 4, 0, 0]} />
                          <Bar dataKey={`CA ${performance.anneeN1}`} fill="#c7d2fe" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Detail table by genre */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="pt-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">{"Détail par genre"}</h3>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-gray-100">
                            <TableHead className="text-xs uppercase tracking-wider text-gray-400">Genre</TableHead>
                            <TableHead className="text-right text-xs uppercase tracking-wider text-gray-400">CA {performance.anneeN}</TableHead>
                            <TableHead className="text-right text-xs uppercase tracking-wider text-gray-400">CA {performance.anneeN1}</TableHead>
                            <TableHead className="text-right text-xs uppercase tracking-wider text-gray-400">{"Évol."}</TableHead>
                            <TableHead className="text-right text-xs uppercase tracking-wider text-gray-400">{"Qté"} {performance.anneeN}</TableHead>
                            <TableHead className="text-right text-xs uppercase tracking-wider text-gray-400">PM {performance.anneeN}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            const genres = new Set<string>();
                            performance.n.parGenre.forEach((g) => genres.add(g.genre));
                            performance.n1.parGenre.forEach((g) => genres.add(g.genre));
                            return Array.from(genres).map((genre) => {
                              const nRow = performance.n.parGenre.find((g) => g.genre === genre);
                              const n1Row = performance.n1.parGenre.find((g) => g.genre === genre);
                              const caN = nRow?.caTtc || 0;
                              const caN1 = n1Row?.caTtc || 0;
                              const evol = caN1 !== 0 ? ((caN - caN1) / Math.abs(caN1)) * 100 : 0;
                              return (
                                <TableRow key={genre} className="border-gray-50 hover:bg-gray-50/50 transition-colors">
                                  <TableCell className="text-sm font-medium">{genre}</TableCell>
                                  <TableCell className="text-right tabular-nums font-semibold">{formatEuro(caN)}</TableCell>
                                  <TableCell className="text-right tabular-nums text-gray-500">{formatEuro(caN1)}</TableCell>
                                  <TableCell className="text-right">
                                    <span className={`text-sm font-semibold ${
                                      evol > 0 ? "text-emerald-600" : evol < 0 ? "text-red-600" : "text-gray-400"
                                    }`}>
                                      {formatPct(evol)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">{Math.round(nRow?.qte || 0)}</TableCell>
                                  <TableCell className="text-right tabular-nums text-gray-500">{formatEuro(nRow?.prixMoyen || 0)}</TableCell>
                                </TableRow>
                              );
                            });
                          })()}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
