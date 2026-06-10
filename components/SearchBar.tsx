"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";

interface Filters {
  marques: string[];
  rayons: string[];
  familles: string[];
}

interface SearchBarProps {
  onSearch: (params: Record<string, string>) => void;
  showFilters?: boolean;
  placeholder?: string;
}

export default function SearchBar({
  onSearch,
  showFilters = true,
  placeholder = "Rechercher par nom, référence, chrono ou code-barres...",
}: SearchBarProps) {
  const [q, setQ] = useState("");
  const [marque, setMarque] = useState("");
  const [rayon, setRayon] = useState("");
  const [famille, setFamille] = useState("");
  const [filters, setFilters] = useState<Filters | null>(null);

  useEffect(() => {
    if (showFilters) {
      fetch("/api/filters")
        .then((r) => r.json())
        .then(setFilters)
        .catch(console.error);
    }
  }, [showFilters]);

  const handleSearch = useCallback(() => {
    const params: Record<string, string> = {};
    if (q.trim()) params.q = q.trim();
    if (marque) params.marque = marque;
    if (rayon) params.rayon = rayon;
    if (famille) params.famille = famille;
    onSearch(params);
  }, [q, marque, rayon, famille, onSearch]);

  useEffect(() => {
    const timer = setTimeout(handleSearch, 400);
    return () => clearTimeout(timer);
  }, [handleSearch]);

  return (
    <div className="space-y-3">
      <Input
        type="text"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full"
      />
      {showFilters && filters && (
        <div className="flex flex-wrap gap-3">
          <select
            value={marque}
            onChange={(e) => setMarque(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Toutes les marques</option>
            {filters.marques.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={rayon}
            onChange={(e) => setRayon(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Tous les rayons</option>
            {filters.rayons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={famille}
            onChange={(e) => setFamille(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Toutes les familles</option>
            {filters.familles.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
