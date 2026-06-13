"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  SimpleBarChart,
  SimplePieChart,
  SimpleAreaChart,
} from "@/components/SalesChart";
import Link from "next/link";

interface DashboardData {
  caTotal: number;
  nbTickets: number;
  panierMoyen: number;
  topArticles: {
    ART_ID: number;
    ART_NOM: string;
    ART_REFMRK: string;
    MARQUE: string;
    RAYON: string;
    QTE_VENDUE: number;
    CA_ARTICLE: number;
  }[];
  caParRayon: { RAYON: string; CA: number }[];
  caParMarque: { MARQUE: string; CA: number }[];
  caMensuel: { ANNEE: number; MOIS: number; CA: number }[];
  from: string;
  to: string;
}

const MONTH_NAMES = [
  "", "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
  "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
];

const PRESETS = [
  { label: "Cette année", from: () => `${new Date().getFullYear()}-01-01`, to: () => `${new Date().getFullYear() + 1}-01-01` },
  { label: "Année dernière", from: () => `${new Date().getFullYear() - 1}-01-01`, to: () => `${new Date().getFullYear()}-01-01` },
  { label: "12 derniers mois", from: () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 12);
    return d.toISOString().slice(0, 10);
  }, to: () => new Date().toISOString().slice(0, 10) },
  { label: "Tout", from: () => "2000-01-01", to: () => "2100-01-01" },
];

function formatEuro(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}

function formatEuroFull(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState(0);
  const [from, setFrom] = useState(PRESETS[0].from());
  const [to, setTo] = useState(PRESETS[0].to());

  const fetchData = useCallback(async (fromDate: string, toDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard?from=${fromDate}&to=${toDate}`);
      if (!res.ok) throw new Error("Erreur serveur");
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(from, to);
  }, [from, to, fetchData]);

  const handlePreset = (idx: number) => {
    setActivePreset(idx);
    const preset = PRESETS[idx];
    setFrom(preset.from());
    setTo(preset.to());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-sm text-gray-500">Vue d&apos;ensemble de l&apos;activité</p>
        </div>
        <div className="flex items-center gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => handlePreset(i)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activePreset === i
                  ? "bg-violet-600 text-white shadow-md shadow-violet-200"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-4 w-24 rounded bg-gray-200 mb-3" />
                <div className="h-8 w-32 rounded bg-gray-200" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          Erreur : {error}
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg glow-violet animate-fade-in-up stagger-1">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-violet-100">Chiffre d&apos;affaires</p>
                <p className="mt-1 text-3xl font-bold tracking-tight">{formatEuro(data.caTotal)}</p>
                <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg glow-indigo animate-fade-in-up stagger-2">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-indigo-100">Tickets de caisse</p>
                <p className="mt-1 text-3xl font-bold tracking-tight">
                  {data.nbTickets.toLocaleString("fr-FR")}
                </p>
                <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-fuchsia-500 to-fuchsia-600 text-white shadow-lg glow-rose animate-fade-in-up stagger-3">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-fuchsia-100">Panier moyen</p>
                <p className="mt-1 text-3xl font-bold tracking-tight">
                  {formatEuroFull(data.panierMoyen)}
                </p>
                <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
              </CardContent>
            </Card>
          </div>

          {/* CA mensuel area chart */}
          {data.caMensuel && data.caMensuel.length > 1 && (
            <Card className="border-0 shadow-sm glass-card">
              <CardContent className="pt-6">
                <h3 className="mb-4 text-sm font-semibold text-gray-700">
                  Evolution du CA mensuel
                </h3>
                <SimpleAreaChart
                  data={data.caMensuel.map((m) => ({
                    name: `${MONTH_NAMES[m.MOIS]} ${String(m.ANNEE).slice(2)}`,
                    value: m.CA,
                  }))}
                />
              </CardContent>
            </Card>
          )}

          {/* Top 10 articles */}
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <h3 className="mb-4 text-sm font-semibold text-gray-700">
                Top 10 articles vendus
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                      <th className="pb-3 pr-4 font-medium">#</th>
                      <th className="pb-3 pr-4 font-medium">Article</th>
                      <th className="pb-3 pr-4 font-medium">Marque</th>
                      <th className="pb-3 pr-4 font-medium">Rayon</th>
                      <th className="pb-3 pr-4 text-right font-medium">Qté</th>
                      <th className="pb-3 text-right font-medium">CA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topArticles.map((art, i) => (
                      <tr key={art.ART_ID} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 pr-4">
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            i < 3 ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-500"
                          }`}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <Link
                            href={`/articles/${art.ART_ID}`}
                            className="font-medium text-gray-900 hover:text-violet-600 transition-colors"
                          >
                            {art.ART_NOM}
                          </Link>
                          {art.ART_REFMRK && (
                            <span className="ml-2 text-xs text-gray-400 font-mono">
                              {art.ART_REFMRK}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                            {art.MARQUE}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-xs text-gray-500">{art.RAYON}</td>
                        <td className="py-3 pr-4 text-right tabular-nums text-gray-600">
                          {art.QTE_VENDUE.toLocaleString("fr-FR")}
                        </td>
                        <td className="py-3 text-right tabular-nums font-semibold text-gray-900">
                          {formatEuro(art.CA_ARTICLE)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Charts side by side */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-0 shadow-sm glass-card">
              <CardContent className="pt-6">
                <h3 className="mb-4 text-sm font-semibold text-gray-700">
                  Répartition du CA par rayon
                </h3>
                <SimplePieChart
                  data={data.caParRayon.map((r) => ({
                    name: r.RAYON,
                    value: r.CA,
                  }))}
                />
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm glass-card">
              <CardContent className="pt-6">
                <h3 className="mb-4 text-sm font-semibold text-gray-700">
                  CA par marque (Top 15)
                </h3>
                <SimpleBarChart
                  data={data.caParMarque.map((m) => ({
                    name: m.MARQUE,
                    value: m.CA,
                  }))}
                  color="#8b5cf6"
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
