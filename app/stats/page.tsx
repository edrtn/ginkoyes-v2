"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";

interface YearStat {
  annee: number;
  ca: number;
  nbTickets: number;
  nbArticles: number;
  panierMoyen: number;
  indiceVente: number;
}

function formatEuro(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
}

function formatK(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M€`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k€`;
  return `${v.toFixed(0)}€`;
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
};

export default function StatsPage() {
  const [data, setData] = useState<YearStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((rows) => {
        if (Array.isArray(rows)) {
          setData(rows.filter((r: YearStat) => r.ca > 0));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600" />
          <p className="text-sm text-gray-500">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  // Current year (possibly incomplete) vs last full year
  const currentYear = new Date().getFullYear();
  const lastFull = data.find((d) => d.annee === currentYear - 1);
  const current = data.find((d) => d.annee === currentYear);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Statistiques annuelles</h1>
        <p className="text-sm text-gray-500">CA, panier moyen et indice de vente par année</p>
      </div>

      {/* Summary cards for last full year */}
      {lastFull && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-lg glow-teal">
            <CardContent className="pt-5 pb-4">
              <p className="text-sm font-medium text-teal-100">CA {lastFull.annee}</p>
              <p className="mt-1 text-3xl font-bold tracking-tight">{formatEuro(lastFull.ca)}</p>
              {current && (
                <p className="mt-2 text-xs text-teal-200">
                  {currentYear} en cours : {formatEuro(current.ca)}
                </p>
              )}
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-lg glow-sky">
            <CardContent className="pt-5 pb-4">
              <p className="text-sm font-medium text-cyan-100">Panier moyen {lastFull.annee}</p>
              <p className="mt-1 text-3xl font-bold tracking-tight">{lastFull.panierMoyen.toFixed(2)} €</p>
              {current && (
                <p className="mt-2 text-xs text-cyan-200">
                  {currentYear} en cours : {current.panierMoyen.toFixed(2)} €
                </p>
              )}
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-200">
            <CardContent className="pt-5 pb-4">
              <p className="text-sm font-medium text-emerald-100">Indice de vente {lastFull.annee}</p>
              <p className="mt-1 text-3xl font-bold tracking-tight">{lastFull.indiceVente.toFixed(2)}</p>
              {current && (
                <p className="mt-2 text-xs text-emerald-200">
                  {currentYear} en cours : {current.indiceVente.toFixed(2)}
                </p>
              )}
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* CA bar chart */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Chiffre d&apos;affaires par année</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" />
                  <stop offset="100%" stopColor="#0d9488" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="annee" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatK} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value) => [formatEuro(Number(value)), "CA"]}
                contentStyle={tooltipStyle}
                labelFormatter={(label) => `Année ${label}`}
              />
              <Bar dataKey="ca" fill="url(#caGrad)" radius={[6, 6, 0, 0]} barSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Panier moyen + Indice de vente line chart */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">Panier moyen par année</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="annee" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v.toFixed(0)}€`}
                />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(2)} €`, "Panier moyen"]}
                  contentStyle={tooltipStyle}
                  labelFormatter={(label) => `Année ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="panierMoyen"
                  stroke="#14b8a6"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: "#14b8a6", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 7, fill: "#14b8a6", strokeWidth: 2, stroke: "#fff" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">Indice de vente par année</h3>
            <p className="mb-3 text-xs text-gray-400">Nombre moyen d&apos;articles par ticket</p>
            <ResponsiveContainer width="100%" height={256}>
              <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="annee" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  formatter={(value) => [Number(value).toFixed(2), "Indice de vente"]}
                  contentStyle={tooltipStyle}
                  labelFormatter={(label) => `Année ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="indiceVente"
                  stroke="#0ea5e9"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: "#0ea5e9", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 7, fill: "#0ea5e9", strokeWidth: 2, stroke: "#fff" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Data table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Détail par année</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="pb-3 pr-4 font-medium">Année</th>
                  <th className="pb-3 pr-4 text-right font-medium">CA TTC</th>
                  <th className="pb-3 pr-4 text-right font-medium">Tickets</th>
                  <th className="pb-3 pr-4 text-right font-medium">Articles vendus</th>
                  <th className="pb-3 pr-4 text-right font-medium">Panier moyen</th>
                  <th className="pb-3 text-right font-medium">Indice de vente</th>
                </tr>
              </thead>
              <tbody>
                {[...data].reverse().map((row, i) => {
                  const prev = data.find((d) => d.annee === row.annee - 1);
                  const caEvol = prev && prev.ca > 0 ? ((row.ca - prev.ca) / prev.ca) * 100 : null;
                  const isCurrentYear = row.annee === currentYear;

                  return (
                    <tr key={row.annee} className={`border-t border-gray-100 transition-colors ${i === 0 ? "bg-teal-50/30" : "hover:bg-gray-50/50"}`}>
                      <td className="py-3 pr-4">
                        <span className="font-semibold text-gray-900">{row.annee}</span>
                        {isCurrentYear && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            en cours
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="tabular-nums font-semibold text-gray-900">{formatEuro(row.ca)}</span>
                        {caEvol !== null && !isCurrentYear && (
                          <span className={`ml-2 text-xs font-medium ${caEvol >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {caEvol >= 0 ? "+" : ""}{caEvol.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-gray-600">
                        {row.nbTickets.toLocaleString("fr-FR")}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-gray-600">
                        {row.nbArticles.toLocaleString("fr-FR")}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums font-medium text-gray-900">
                        {row.panierMoyen.toFixed(2)} €
                      </td>
                      <td className="py-3 text-right">
                        <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-700">
                          {row.indiceVente.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
