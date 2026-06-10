"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Article {
  ART_ID: number;
  ART_NOM: string;
  ART_REFMRK: string;
  ARF_CHRONO: string;
  MARQUE: string;
  RAYON: string;
  FAMILLE: string;
  GENRE: string;
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async (params: Record<string, string>) => {
    if (Object.keys(params).length === 0) {
      setArticles([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    try {
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`/api/articles?${qs}`);
      if (!res.ok) throw new Error("Erreur");
      const data = await res.json();
      setArticles(data);
      setSearched(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Recherche articles</h1>

      <SearchBar onSearch={handleSearch} />

      {loading && (
        <div className="py-10 text-center text-gray-500">Recherche en cours...</div>
      )}

      {!loading && searched && articles.length === 0 && (
        <div className="py-10 text-center text-gray-500">Aucun article trouvé.</div>
      )}

      {!loading && articles.length > 0 && (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Réf. marque</TableHead>
                <TableHead>Chrono</TableHead>
                <TableHead>Marque</TableHead>
                <TableHead>Rayon</TableHead>
                <TableHead>Famille</TableHead>
                <TableHead>Genre</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles.map((art) => (
                <TableRow key={art.ART_ID} className="hover:bg-gray-50">
                  <TableCell>
                    <Link
                      href={`/articles/${art.ART_ID}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {art.ART_NOM}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {art.ART_REFMRK}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {art.ARF_CHRONO}
                  </TableCell>
                  <TableCell>
                    {art.MARQUE && <Badge variant="secondary">{art.MARQUE}</Badge>}
                  </TableCell>
                  <TableCell>{art.RAYON}</TableCell>
                  <TableCell>{art.FAMILLE}</TableCell>
                  <TableCell>{art.GENRE}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t px-4 py-2 text-sm text-gray-500">
            {articles.length} résultat{articles.length > 1 ? "s" : ""} (max 50)
          </div>
        </div>
      )}
    </div>
  );
}
