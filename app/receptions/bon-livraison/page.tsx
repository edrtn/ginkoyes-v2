"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

// ── Types ────────────────────────────────────────────────

interface SizeQty {
  size: string;
  qty: number;
}

interface ColourEntry {
  colour: string;
  variantName?: string;
  sizes: SizeQty[];
  total: number;
}

interface Article {
  styleNo: string;
  styleName: string;
  colours: ColourEntry[];
  totalPieces: number;
}

interface DeliveryNote {
  noteNumber: string;
  orderNumber: string;
  createdDate: string;
  customerRef?: string;
  supplier: string;
  brand: string;
  totalPieces: number;
  totalBoxes: number;
  articles: Article[];
}

interface ParseResult {
  deliveryNotes: DeliveryNote[];
}

interface SavedAnalysis {
  id: number;
  file_name: string;
  supplier: string;
  brand: string;
  total_notes: number;
  total_articles: number;
  total_pieces: number;
  created_at: string;
}

// ── Photo helpers ────────────────────────────────────────

function buildPhotoUrl(brand: string, styleNo: string): string {
  // "JACK & JONES" → "JACK AND JONES" → URL-encoded
  const cleaned = brand.trim().toUpperCase().replace(/&/g, "AND");
  const m = encodeURIComponent(cleaned);
  return `https://media.sport2000.fr/photos_plateforme_digitale/${m}/app-${styleNo}-p.jpg`;
}

function PhotoPlaceholder({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-gray-100 ${className || ""}`}>
      <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
      </svg>
    </div>
  );
}

function ProductPhoto({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [err, setErr] = useState(false);
  if (err) return <PhotoPlaceholder className={className} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setErr(true)}
    />
  );
}

// ── Main component ───────────────────────────────────────

export default function BonLivraisonPage() {
  const [result, setResult] = useState<ParseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [history, setHistory] = useState<SavedAnalysis[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [checkMode, setCheckMode] = useState(false);
  // key = "noteIdx-artIdx-cIdx-size", value = received qty
  const [checks, setChecks] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load history on mount
  useEffect(() => {
    fetch("/api/bon-livraison/list")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setHistory(data);
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      setError("Le fichier doit être un PDF.");
      return;
    }
    setFileName(file.name);
    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(false);
    setViewingId(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/bon-livraison/parse", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors du traitement");
      }

      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!result) return;
    setSaving(true);
    try {
      // Build name: MARQUE — DATE — BL n°xxx, n°yyy
      const notes = result.deliveryNotes;
      const brand = notes[0]?.brand || notes[0]?.supplier || "Inconnu";
      const date = notes[0]?.createdDate || new Date().toLocaleDateString("fr-FR");
      const blNums = notes.map((n) => `n°${n.noteNumber}`).join(", ");
      const saveName = `${brand} — ${date} — BL ${blNums}`;

      const res = await fetch("/api/bon-livraison/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: saveName, parsedData: result }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved(true);
      setViewingId(data.id);
      // Refresh history
      const listRes = await fetch("/api/bon-livraison/list");
      const listData = await listRes.json();
      if (Array.isArray(listData)) setHistory(listData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur sauvegarde");
    } finally {
      setSaving(false);
    }
  }, [result, fileName]);

  const handleLoadSaved = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(true);
    setViewingId(id);

    try {
      const res = await fetch(`/api/bon-livraison/analyses?id=${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFileName(data.file_name);
      setResult(data.parsed_data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur chargement");
      setSaved(false);
      setViewingId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleReset = useCallback(() => {
    setResult(null);
    setError(null);
    setFileName(null);
    setSaved(false);
    setViewingId(null);
    setCheckMode(false);
    setChecks({});
    setSearchTerm("");
  }, []);

  const handleDelete = useCallback(async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Supprimer cette analyse ?")) return;
    try {
      await fetch(`/api/bon-livraison/analyses?id=${id}`, { method: "DELETE" });
      setHistory((prev) => prev.filter((h) => h.id !== id));
      if (viewingId === id) handleReset();
    } catch {
      // ignore
    }
  }, [viewingId, handleReset]);

  const setCheck = useCallback((key: string, value: number) => {
    setChecks((prev) => ({ ...prev, [key]: value }));
  }, []);

  const grandTotalPieces = result
    ? result.deliveryNotes.reduce((s, n) => s + n.totalPieces, 0)
    : 0;
  const grandTotalArticles = result
    ? result.deliveryNotes.reduce((s, n) => s + n.articles.length, 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/receptions"
        className="inline-flex items-center gap-1 text-sm text-rose-600 hover:text-rose-800 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Retour aux réceptions
      </Link>

      <h1 className="text-2xl font-bold text-gray-900">Lecture bon de livraison</h1>

      {/* Upload zone — shown when no result and not loading */}
      {!result && !loading && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
              dragOver
                ? "border-rose-400 bg-rose-50"
                : "border-gray-300 bg-white hover:border-rose-300 hover:bg-rose-50/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleInputChange}
              className="hidden"
            />
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            <p className="mt-3 text-sm font-medium text-gray-700">
              Glissez un bon de livraison PDF ici
            </p>
            <p className="mt-1 text-xs text-gray-500">
              ou cliquez pour sélectionner un fichier
            </p>
          </div>

          {/* Saved analyses history */}
          {!historyLoading && history.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Analyses sauvegardées</h2>
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
                {history.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => handleLoadSaved(h.id)}
                    className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors first:rounded-t-xl last:rounded-b-xl"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{h.file_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {h.brand && (
                          <span className="rounded bg-rose-50 px-1.5 py-0.5 text-xs font-medium text-rose-600">
                            {h.brand}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {new Date(h.created_at).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs text-gray-500">
                      <span>{h.total_notes} BL</span>
                      <span>{h.total_articles} art.</span>
                      <span className="font-semibold text-rose-600">{h.total_pieces} pcs</span>
                      <button
                        onClick={(e) => handleDelete(h.id, e)}
                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Supprimer"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Loading state */}
      {loading && (
        <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
          <p className="mt-4 text-sm font-medium text-gray-700">
            {viewingId
              ? "Chargement de l'analyse..."
              : <>Analyse de <span className="font-mono text-rose-600">{fileName}</span> en cours...</>
            }
          </p>
          {!viewingId && (
            <p className="mt-1 text-xs text-gray-500">
              Lecture par intelligence artificielle, cela peut prendre quelques secondes
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <span className="font-medium">Erreur :</span> {error}
          <button
            onClick={handleReset}
            className="ml-3 text-red-600 underline hover:text-red-800"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-6">
          {/* Action bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                saved ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
              }`}>
                {saved ? "Sauvegardé" : "Analyse terminée"}
              </span>
              <span className="text-sm text-gray-500">{fileName}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCheckMode((v) => !v)}
                className={`rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
                  checkMode
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                {checkMode ? "Mode vérification ON" : "Vérifier réception"}
              </button>
              {!saved && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Sauvegarde..." : "Sauvegarder"}
                </button>
              )}
              <button
                onClick={handleReset}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
              >
                Nouveau fichier
              </button>
            </div>
          </div>

          {/* Summary KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-rose-500 to-rose-600 text-white">
              <CardContent className="pt-5 pb-4">
                <p className="text-sm font-medium text-rose-100">Bons de livraison</p>
                <p className="text-2xl font-bold mt-1">{result.deliveryNotes.length}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-pink-500 to-pink-600 text-white">
              <CardContent className="pt-5 pb-4">
                <p className="text-sm font-medium text-pink-100">Articles</p>
                <p className="text-2xl font-bold mt-1">{grandTotalArticles}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-fuchsia-500 to-fuchsia-600 text-white">
              <CardContent className="pt-5 pb-4">
                <p className="text-sm font-medium text-fuchsia-100">Pièces totales</p>
                <p className="text-2xl font-bold mt-1">{grandTotalPieces}</p>
              </CardContent>
            </Card>
          </div>

          {/* Check mode progress */}
          {checkMode && (() => {
            let totalCells = 0;
            let checkedCells = 0;
            let okCells = 0;
            let koCells = 0;
            result.deliveryNotes.forEach((note, nIdx) => {
              note.articles.forEach((art, aIdx) => {
                art.colours.forEach((coul, cIdx) => {
                  coul.sizes.forEach((s) => {
                    if (s.qty > 0) {
                      totalCells++;
                      const key = `${nIdx}-${aIdx}-${cIdx}-${s.size}`;
                      if (checks[key] !== undefined) {
                        checkedCells++;
                        if (checks[key] === s.qty) okCells++;
                        else koCells++;
                      }
                    }
                  });
                });
              });
            });
            const pct = totalCells > 0 ? Math.round((checkedCells / totalCells) * 100) : 0;
            return (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-emerald-800">Vérification</span>
                    <span className="text-emerald-600">{checkedCells}/{totalCells} contrôlés ({pct}%)</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-medium">
                    {okCells > 0 && (
                      <span className="flex items-center gap-1 text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {okCells} OK
                      </span>
                    )}
                    {koCells > 0 && (
                      <span className="flex items-center gap-1 text-red-700">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        {koCells} écart{koCells > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-emerald-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })()}

          {/* Search bar */}
          <div className="relative">
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
              ref={searchInputRef}
              type="text"
              placeholder="Rechercher un article (n° style, nom, couleur...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-10 text-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(""); searchInputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Delivery notes */}
          {result.deliveryNotes.map((note, noteIdx) => {
            // Filter articles by search term
            const term = searchTerm.trim().toUpperCase();
            const filteredArticles = term
              ? note.articles.filter(
                  (art) =>
                    art.styleNo.toUpperCase().includes(term) ||
                    art.styleName.toUpperCase().includes(term) ||
                    art.colours.some((c) => c.colour.toUpperCase().includes(term) || (c.variantName || "").toUpperCase().includes(term))
                )
              : note.articles;

            // Skip note entirely if no articles match
            if (term && filteredArticles.length === 0) return null;

            return (
            <div key={noteIdx} className="space-y-4">
              {/* Note header */}
              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    BL {note.noteNumber}
                  </h2>
                  {note.brand && (
                    <span className="inline-flex items-center rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-sm font-semibold text-rose-700">
                      {note.brand}
                    </span>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
                  <div>
                    <span className="text-gray-400 text-xs uppercase tracking-wider">Date</span>
                    <p className="font-semibold text-gray-900 mt-0.5">{note.createdDate || "-"}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs uppercase tracking-wider">N° commande</span>
                    <p className="font-mono font-semibold text-gray-900 mt-0.5">{note.orderNumber || "-"}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs uppercase tracking-wider">Fournisseur</span>
                    <p className="font-semibold text-gray-900 mt-0.5">{note.supplier || "-"}</p>
                  </div>
                  {note.customerRef && (
                    <div>
                      <span className="text-gray-400 text-xs uppercase tracking-wider">Réf. client</span>
                      <p className="font-semibold text-gray-900 mt-0.5">{note.customerRef}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-400 text-xs uppercase tracking-wider">Pièces</span>
                    <p className="font-semibold text-rose-600 mt-0.5">{note.totalPieces}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs uppercase tracking-wider">Colis</span>
                    <p className="font-semibold text-gray-900 mt-0.5">{note.totalBoxes}</p>
                  </div>
                </div>
              </div>

              {/* Article cards */}
              <div className="space-y-3">
                {filteredArticles.map((art) => {
                  // Use original index for check keys
                  const artIdx = note.articles.indexOf(art);
                  const photoUrl = note.brand
                    ? buildPhotoUrl(note.brand, art.styleNo)
                    : null;

                  // Collect all unique sizes across all colours for consistent grid
                  const allSizes: string[] = [];
                  for (const c of art.colours) {
                    for (const s of c.sizes) {
                      if (!allSizes.includes(s.size)) allSizes.push(s.size);
                    }
                  }

                  return (
                    <Card key={artIdx} className="border shadow-sm overflow-hidden">
                      {/* Article header with photo */}
                      <div className="flex border-b border-gray-100 bg-gray-50/50">
                        {/* Product photo */}
                        <div className="w-24 h-24 shrink-0 border-r border-gray-100 bg-white">
                          {photoUrl ? (
                            <ProductPhoto
                              src={photoUrl}
                              alt={art.styleName}
                              className="h-full w-full object-contain p-2"
                            />
                          ) : (
                            <PhotoPlaceholder className="h-full w-full" />
                          )}
                        </div>

                        {/* Article info */}
                        <div className="flex flex-1 items-center justify-between px-5 py-3 min-w-0">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">
                              {art.styleName}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500">
                                {art.styleNo}
                              </span>
                            </div>
                          </div>
                          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700 shrink-0">
                            {art.totalPieces} pcs
                          </span>
                        </div>
                      </div>

                      {/* Size grid per colour */}
                      <CardContent className="p-0 divide-y divide-gray-50">
                        {/* Header row with size labels */}
                        <div className="flex items-center gap-4 px-5 py-2 bg-gray-50/80">
                          <div className="w-40 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Couleur
                          </div>
                          <div className="flex flex-1 gap-1">
                            {allSizes.map((s) => (
                              <div
                                key={s}
                                className="flex-1 min-w-[40px] text-center text-[11px] font-medium text-gray-500 uppercase"
                              >
                                {s}
                              </div>
                            ))}
                            <div className="w-14 text-center text-[11px] font-medium text-gray-500 uppercase">
                              Total
                            </div>
                          </div>
                        </div>

                        {/* Colour rows */}
                        {art.colours.map((coul, cIdx) => {
                          const sizeMap = new Map(coul.sizes.map((s) => [s.size, s.qty]));
                          return (
                            <div key={cIdx} className="flex items-center gap-4 px-5 py-2.5">
                              <div className="w-40 shrink-0 flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-zinc-300 shrink-0" />
                                <span className="text-sm font-medium text-gray-700 truncate" title={coul.variantName || coul.colour}>
                                  {coul.colour}
                                </span>
                              </div>
                              <div className="flex flex-1 gap-1">
                                {allSizes.map((s) => {
                                  const expected = sizeMap.get(s) || 0;
                                  const checkKey = `${noteIdx}-${artIdx}-${cIdx}-${s}`;
                                  const received = checks[checkKey];
                                  const isChecked = received !== undefined;

                                  if (checkMode && expected > 0) {
                                    // Editable cell
                                    const match = isChecked && received === expected;
                                    const mismatch = isChecked && received !== expected;
                                    return (
                                      <div key={s} className="flex-1 min-w-[40px] flex flex-col items-center gap-0.5">
                                        <span className="text-[10px] text-gray-400">{expected}</span>
                                        <input
                                          type="number"
                                          min={0}
                                          value={isChecked ? received : ""}
                                          placeholder="?"
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            if (v === "") {
                                              setChecks((prev) => {
                                                const next = { ...prev };
                                                delete next[checkKey];
                                                return next;
                                              });
                                            } else {
                                              setCheck(checkKey, parseInt(v, 10) || 0);
                                            }
                                          }}
                                          className={`w-full text-center rounded-lg py-1 text-sm font-bold outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                            match
                                              ? "bg-emerald-50 border-2 border-emerald-400 text-emerald-700"
                                              : mismatch
                                                ? "bg-red-50 border-2 border-red-400 text-red-700"
                                                : "bg-white border-2 border-gray-200 text-gray-700"
                                          }`}
                                        />
                                      </div>
                                    );
                                  }

                                  // Read-only cell (no check mode or qty = 0)
                                  let cellClass = "";
                                  if (checkMode && expected === 0 && !isChecked) {
                                    cellClass = "text-gray-300";
                                  } else if (isChecked) {
                                    cellClass = received === expected
                                      ? "bg-emerald-50 border border-emerald-400 text-emerald-700"
                                      : "bg-red-50 border border-red-400 text-red-700";
                                  } else if (expected > 0) {
                                    cellClass = "bg-rose-50 border border-rose-200 text-rose-700";
                                  } else {
                                    cellClass = "text-gray-300";
                                  }

                                  return (
                                    <div
                                      key={s}
                                      className={`flex-1 min-w-[40px] text-center rounded-lg py-1.5 text-sm font-bold ${cellClass}`}
                                    >
                                      {isChecked ? `${received}` : expected > 0 ? expected : "-"}
                                    </div>
                                  );
                                })}
                                <div className="w-14 text-center rounded-lg py-1.5 text-sm font-bold bg-gray-100 text-gray-800">
                                  {coul.total}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Note footer */}
              <div className="rounded-xl border border-gray-200 bg-white px-5 py-3 flex items-center justify-between text-sm text-gray-500">
                <span>
                  {filteredArticles.length} article{filteredArticles.length > 1 ? "s" : ""}
                  {term && ` (sur ${note.articles.length})`}
                </span>
                <span>
                  Total : {note.totalPieces} pièces · {note.totalBoxes} colis
                </span>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
