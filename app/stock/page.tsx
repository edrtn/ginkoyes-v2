"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface StockArticle {
  ART_ID: number;
  ART_NOM: string;
  ART_REFMRK: string;
  MARQUE: string;
  RAYON: string;
  STOCK_TOTAL: number;
  VALORISATION: number;
}

function formatEuro(n: number | null) {
  if (n == null) return "-";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €";
}

export default function StockPage() {
  const [stock, setStock] = useState<StockArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async (params: Record<string, string>) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`/api/stock?${qs}`);
      if (!res.ok) throw new Error("Erreur");
      const data = await res.json();
      setStock(data);
      setSearched(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const totalQte = stock.reduce((s, r) => s + (r.STOCK_TOTAL || 0), 0);
  const totalValor = stock.reduce((s, r) => s + (r.VALORISATION || 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Consultation stock</h1>

      <SearchBar
        onSearch={handleSearch}
        placeholder="Rechercher par nom ou référence..."
      />

      {loading && (
        <div className="py-10 text-center text-gray-500">Chargement...</div>
      )}

      {!loading && searched && stock.length === 0 && (
        <div className="py-10 text-center text-gray-500">
          Aucun article en stock trouvé.
        </div>
      )}

      {!loading && stock.length > 0 && (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Article</TableHead>
                <TableHead>Réf. marque</TableHead>
                <TableHead>Marque</TableHead>
                <TableHead>Rayon</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Valorisation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stock.map((s) => (
                <TableRow key={s.ART_ID} className="hover:bg-gray-50">
                  <TableCell>
                    <Link
                      href={`/articles/${s.ART_ID}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {s.ART_NOM}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {s.ART_REFMRK}
                  </TableCell>
                  <TableCell>
                    {s.MARQUE && <Badge variant="secondary">{s.MARQUE}</Badge>}
                  </TableCell>
                  <TableCell>{s.RAYON}</TableCell>
                  <TableCell className="text-right font-medium">
                    {s.STOCK_TOTAL}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatEuro(s.VALORISATION)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-between border-t px-4 py-2 text-sm text-gray-500">
            <span>
              {stock.length} article{stock.length > 1 ? "s" : ""} (max 100)
            </span>
            <span>
              Total : {totalQte} pièces / {formatEuro(totalValor)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
