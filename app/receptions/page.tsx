"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Reception {
  BRE_ID: number;
  BRE_DATE: string;
  BRE_NUMERO: string;
  BRE_NUMFOURN: string;
  FOU_NOM: string;
  NB_ARTICLES: number;
  QTE_TOTALE: number;
  MONTANT_ACHAT: number;
}

function formatDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("fr-FR");
}

function formatEuro(n: number | null) {
  if (n == null) return "-";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €";
}

export default function ReceptionsPage() {
  const [receptions, setReceptions] = useState<Reception[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/receptions")
      .then((r) => r.json())
      .then((data) => setReceptions(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return receptions;
    const term = search.toUpperCase();
    return receptions.filter(
      (r) =>
        (r.FOU_NOM && r.FOU_NOM.toUpperCase().includes(term)) ||
        (r.BRE_NUMERO && r.BRE_NUMERO.toUpperCase().includes(term)) ||
        (r.BRE_NUMFOURN && r.BRE_NUMFOURN.toUpperCase().includes(term))
    );
  }, [receptions, search]);

  const totalQte = filtered.reduce((s, r) => s + (r.QTE_TOTALE || 0), 0);
  const totalMontant = filtered.reduce((s, r) => s + (r.MONTANT_ACHAT || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Réceptions</h1>
        <Link
          href="/receptions/bon-livraison"
          className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          Lire un bon de livraison
        </Link>
      </div>

      <div className="relative max-w-md">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          type="text"
          placeholder="Filtrer par fournisseur ou n° BR..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
        />
      </div>

      {loading && (
        <div className="py-10 text-center text-gray-500">Chargement...</div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="py-10 text-center text-gray-500">
          Aucune réception trouvée.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>N° BR</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Réf. fournisseur</TableHead>
                <TableHead className="text-right">Nb articles</TableHead>
                <TableHead className="text-right">Qté totale</TableHead>
                <TableHead className="text-right">Montant achat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.BRE_ID} className="hover:bg-gray-50">
                  <TableCell>{formatDate(r.BRE_DATE)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/receptions/${r.BRE_ID}`}
                      className="text-rose-600 hover:text-rose-800 hover:underline"
                    >
                      {r.BRE_NUMERO}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{r.FOU_NOM}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.BRE_NUMFOURN}
                  </TableCell>
                  <TableCell className="text-right">{r.NB_ARTICLES}</TableCell>
                  <TableCell className="text-right font-medium">
                    {r.QTE_TOTALE}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatEuro(r.MONTANT_ACHAT)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-between border-t px-4 py-2 text-sm text-gray-500">
            <span>
              {filtered.length} réception{filtered.length > 1 ? "s" : ""}
              {search.trim() ? ` (sur ${receptions.length})` : ""}
            </span>
            <span>
              Total : {totalQte} pièces / {formatEuro(totalMontant)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
