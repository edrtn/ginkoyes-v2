"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ---------- Types ----------

interface Rayon {
  RAY_ID: number;
  RAY_NOM: string;
  articleCount: number;
  familleCount: number;
}

interface Famille {
  FAM_ID: number;
  FAM_NOM: string;
  FAM_RAYID: number;
  articleCount: number;
}

interface Article {
  ART_ID: number;
  ART_NOM: string;
  ART_REFMRK: string;
  ARF_CHRONO: string;
  MARQUE: string;
  GENRE: string;
  STOCK_TOTAL: number;
}

// ---------- Component ----------

export default function ArticlesPage() {
  // Navigation state
  const [selectedRayon, setSelectedRayon] = useState<Rayon | null>(null);
  const [selectedFamille, setSelectedFamille] = useState<Famille | null>(null);

  // Data
  const [rayons, setRayons] = useState<Rayon[]>([]);
  const [familles, setFamilles] = useState<Famille[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");

  // ---------- Fetch categories on mount ----------
  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => {
        setRayons(data.rayons || []);
        setFamilles(data.familles || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ---------- Fetch articles when famille selected ----------
  const fetchArticles = useCallback(async (familleNom: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/articles/by-famille?famille=${encodeURIComponent(familleNom)}`
      );
      if (!res.ok) throw new Error("Erreur");
      const data = await res.json();
      setArticles(data);
    } catch (e) {
      console.error(e);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ---------- Navigation handlers ----------
  const handleSelectRayon = (rayon: Rayon) => {
    setSelectedRayon(rayon);
    setSelectedFamille(null);
    setArticles([]);
    setSearchQ("");
  };

  const handleSelectFamille = (famille: Famille) => {
    setSelectedFamille(famille);
    setSearchQ("");
    fetchArticles(famille.FAM_NOM);
  };

  const handleGoToRoot = () => {
    setSelectedRayon(null);
    setSelectedFamille(null);
    setArticles([]);
    setSearchQ("");
  };

  const handleGoToRayon = () => {
    setSelectedFamille(null);
    setArticles([]);
    setSearchQ("");
  };

  // ---------- Derived data ----------
  const filteredFamilles = selectedRayon
    ? familles.filter((f) => f.FAM_RAYID === selectedRayon.RAY_ID)
    : [];

  const filteredArticles = searchQ.trim()
    ? articles.filter((a) => {
        const term = searchQ.toUpperCase();
        return (
          a.ART_NOM?.toUpperCase().includes(term) ||
          a.ART_REFMRK?.toUpperCase().includes(term) ||
          a.ARF_CHRONO?.toUpperCase().includes(term) ||
          a.MARQUE?.toUpperCase().includes(term)
        );
      })
    : articles;

  // ---------- Render ----------
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <button
          onClick={handleGoToRoot}
          className={`hover:text-sky-600 ${!selectedRayon ? "font-bold text-gray-900" : "hover:underline"}`}
        >
          Articles
        </button>
        {selectedRayon && (
          <>
            <span>/</span>
            <button
              onClick={handleGoToRayon}
              className={`hover:text-sky-600 ${!selectedFamille ? "font-bold text-gray-900" : "hover:underline"}`}
            >
              {selectedRayon.RAY_NOM}
            </button>
          </>
        )}
        {selectedFamille && (
          <>
            <span>/</span>
            <span className="font-bold text-gray-900">
              {selectedFamille.FAM_NOM}
            </span>
          </>
        )}
      </nav>

      {/* Loading */}
      {loading && (
        <div className="py-10 text-center text-gray-500">Chargement...</div>
      )}

      {/* Niveau 0 — Rayons */}
      {!loading && !selectedRayon && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {rayons.map((rayon) => (
            <button
              key={rayon.RAY_ID}
              onClick={() => handleSelectRayon(rayon)}
              className="rounded-xl border bg-white p-5 glass-card text-left shadow-sm transition hover:border-sky-300 hover:shadow-md"
            >
              <h3 className="font-semibold text-gray-900">{rayon.RAY_NOM}</h3>
              <p className="mt-1 text-xs text-gray-500">
                {rayon.familleCount} famille{rayon.familleCount > 1 ? "s" : ""}
                {" · "}
                {rayon.articleCount} article{rayon.articleCount > 1 ? "s" : ""}
              </p>
            </button>
          ))}
          {rayons.length === 0 && (
            <div className="col-span-full py-10 text-center text-gray-500">
              Aucun rayon trouvé.
            </div>
          )}
        </div>
      )}

      {/* Niveau 1 — Familles */}
      {!loading && selectedRayon && !selectedFamille && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filteredFamilles.map((famille) => (
            <button
              key={famille.FAM_ID}
              onClick={() => handleSelectFamille(famille)}
              className="rounded-xl border bg-white p-5 glass-card text-left shadow-sm transition hover:border-sky-300 hover:shadow-md"
            >
              <h3 className="font-semibold text-gray-900">
                {famille.FAM_NOM}
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                {famille.articleCount} article
                {famille.articleCount > 1 ? "s" : ""}
              </p>
            </button>
          ))}
          {filteredFamilles.length === 0 && (
            <div className="col-span-full py-10 text-center text-gray-500">
              Aucune famille dans ce rayon.
            </div>
          )}
        </div>
      )}

      {/* Niveau 2 — Articles */}
      {!loading && selectedFamille && (
        <>
          {/* Search within famille */}
          <Input
            type="text"
            placeholder="Filtrer par nom, référence, marque..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="max-w-md"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredArticles.map((art) => (
              <Link
                key={art.ART_ID}
                href={`/articles/${art.ART_ID}`}
                className="flex items-start justify-between rounded-xl border bg-white p-4 glass-card shadow-sm transition hover:border-sky-300 hover:shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-medium text-gray-900">
                    {art.ART_NOM}
                  </h3>
                  <p className="mt-0.5 font-mono text-xs text-gray-400">
                    {art.ART_REFMRK}
                    {art.ARF_CHRONO ? ` · ${art.ARF_CHRONO}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {art.MARQUE && (
                      <Badge variant="secondary">{art.MARQUE}</Badge>
                    )}
                    {art.GENRE && (
                      <Badge variant="outline">{art.GENRE}</Badge>
                    )}
                  </div>
                </div>
                <StockBadge stock={art.STOCK_TOTAL} />
              </Link>
            ))}
          </div>

          {filteredArticles.length === 0 && (
            <div className="py-10 text-center text-gray-500">
              Aucun article trouvé.
            </div>
          )}

          <div className="text-sm text-gray-500">
            {filteredArticles.length} article
            {filteredArticles.length > 1 ? "s" : ""}
            {searchQ.trim() ? ` (filtré sur "${searchQ.trim()}")` : ""}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Stock badge ----------

function StockBadge({ stock }: { stock: number }) {
  let color: string;
  if (stock <= 0) {
    color = "bg-red-100 text-red-700";
  } else if (stock <= 5) {
    color = "bg-yellow-100 text-yellow-700";
  } else {
    color = "bg-green-100 text-green-700";
  }

  return (
    <span
      className={`ml-3 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}
    >
      {stock}
    </span>
  );
}
