"use client";

import { useState, useEffect, useCallback } from "react";
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

// ---------- Types ----------

interface StockArticle {
  ART_ID: number;
  ART_NOM: string;
  ART_REFMRK: string;
  MARQUE: string;
  RAYON: string;
  STOCK_TOTAL: number;
  VALORISATION: number;
}

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

interface BrandInfo {
  MARQUE: string;
  NB_ARTICLES: number;
  STOCK_TOTAL: number;
}

type ViewMode = "search" | "categories" | "brands";

// ---------- Brand logo helpers ----------

const BRAND_COLORS = [
  "from-blue-500 to-blue-600",
  "from-violet-500 to-violet-600",
  "from-rose-500 to-rose-600",
  "from-amber-500 to-amber-600",
  "from-teal-500 to-teal-600",
  "from-indigo-500 to-indigo-600",
  "from-sky-500 to-sky-600",
  "from-fuchsia-500 to-fuchsia-600",
  "from-orange-500 to-orange-600",
  "from-cyan-500 to-cyan-600",
];

function brandColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BRAND_COLORS[Math.abs(hash) % BRAND_COLORS.length];
}

function brandInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Brand domain mapping for logo lookups
const BRAND_DOMAINS: Record<string, string> = {
  "NIKE": "nike.com",
  "ADIDAS": "adidas.com",
  "PUMA": "puma.com",
  "REEBOK": "reebok.com",
  "NEW BALANCE": "newbalance.com",
  "ASICS": "asics.com",
  "SALOMON": "salomon.com",
  "THE NORTH FACE": "thenorthface.com",
  "COLUMBIA": "columbia.com",
  "PATAGONIA": "patagonia.com",
  "VANS": "vans.com",
  "CONVERSE": "converse.com",
  "UNDER ARMOUR": "underarmour.com",
  "LACOSTE": "lacoste.com",
  "HOKA": "hoka.com",
  "SAUCONY": "saucony.com",
  "FILA": "fila.com",
  "LEVI'S": "levi.com",
  "LEVIS": "levi.com",
  "TIMBERLAND": "timberland.com",
  "NAPAPIJRI": "napapijri.com",
  "QUIKSILVER": "quiksilver.com",
  "ROXY": "roxy.com",
  "BILLABONG": "billabong.com",
  "ROSSIGNOL": "rossignol.com",
  "HEAD": "head.com",
  "WILSON": "wilson.com",
  "BABOLAT": "babolat.com",
  "ARENA": "arenasport.com",
  "SPEEDO": "speedo.com",
  "OAKLEY": "oakley.com",
  "RAY-BAN": "ray-ban.com",
  "HAVAIANAS": "havaianas.com",
  "BIRKENSTOCK": "birkenstock.com",
  "CROCS": "crocs.com",
  "SKECHERS": "skechers.com",
  "KAPPA": "kappa.com",
  "ELLESSE": "ellesse.com",
  "CHAMPION": "champion.com",
  "SUPERDRY": "superdry.com",
  "RIP CURL": "ripcurl.com",
  "HURLEY": "hurley.com",
  "VOLCOM": "volcom.com",
  "DC SHOES": "dcshoes.com",
  "LOTTO": "lotto.it",
  "DIADORA": "diadora.com",
  "MIZUNO": "mizuno.com",
  "BROOKS": "brooksrunning.com",
  "MILLET": "millet.fr",
  "EIDER": "eider.com",
  "AIGLE": "aigle.com",
  "LE COQ SPORTIF": "lecoqsportif.com",
  "SERGIO TACCHINI": "sergiotacchini.com",
  "TECNIFIBRE": "tecnifibre.com",
  "YONEX": "yonex.com",
  "SCOTT": "scott-sports.com",
  "CRAFT": "craftsportswear.com",
  "ODLO": "odlo.com",
  "BUFF": "buff.com",
  "COMPRESSPORT": "compressport.com",
  "JULBO": "julbo.com",
  "ATOMIC": "atomic.com",
  "DYNASTAR": "dynastar.com",
  "GARMIN": "garmin.com",
  "SUUNTO": "suunto.com",
  "POLAR": "polar.com",
  "DEUTER": "deuter.com",
  "OSPREY": "osprey.com",
  "MAMMUT": "mammut.com",
  "ARC'TERYX": "arcteryx.com",
  "PETZL": "petzl.com",
  "MERRELL": "merrell.com",
  "UMBRO": "umbro.com",
};

function brandLogoUrl(name: string): string {
  const upper = name.toUpperCase().trim();
  const domain = BRAND_DOMAINS[upper];
  if (domain) {
    return `https://api.companyenrich.com/logo/${domain}`;
  }
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `https://api.companyenrich.com/logo/${slug}.com`;
}

function BrandLogo({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const [errored, setErrored] = useState(false);
  const logoUrl = brandLogoUrl(name);
  const sizeClasses = size === "sm" ? "h-8 w-8" : "h-12 w-12";
  const textSize = size === "sm" ? "text-[10px]" : "text-sm";

  if (errored) {
    return (
      <div className={`${sizeClasses} flex items-center justify-center rounded-xl bg-gradient-to-br ${brandColor(name)} text-white font-bold ${textSize} shrink-0`}>
        {brandInitials(name)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt={name}
      className={`${sizeClasses} rounded-xl object-contain bg-white border border-gray-100 p-1 shrink-0`}
      onError={() => setErrored(true)}
    />
  );
}

// ---------- Helpers ----------

function formatEuro(n: number | null) {
  if (n == null) return "-";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €";
}

// ---------- Component ----------

export default function StockPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("brands");

  // Search results
  const [stock, setStock] = useState<StockArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Categories
  const [rayons, setRayons] = useState<Rayon[]>([]);
  const [familles, setFamilles] = useState<Famille[]>([]);
  const [selectedRayon, setSelectedRayon] = useState<Rayon | null>(null);
  const [selectedFamille, setSelectedFamille] = useState<Famille | null>(null);
  const [catsLoading, setCatsLoading] = useState(false);

  // Brands
  const [brands, setBrands] = useState<BrandInfo[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [brandSearch, setBrandSearch] = useState("");

  // Fetch categories
  useEffect(() => {
    if (viewMode === "categories" && rayons.length === 0) {
      setCatsLoading(true);
      fetch("/api/categories")
        .then((r) => r.json())
        .then((data) => {
          setRayons(data.rayons || []);
          setFamilles(data.familles || []);
        })
        .catch(console.error)
        .finally(() => setCatsLoading(false));
    }
  }, [viewMode, rayons.length]);

  // Fetch brands
  useEffect(() => {
    if (viewMode === "brands" && brands.length === 0) {
      setBrandsLoading(true);
      fetch("/api/stock/brands")
        .then((r) => r.json())
        .then((data) => setBrands(Array.isArray(data) ? data : []))
        .catch(console.error)
        .finally(() => setBrandsLoading(false));
    }
  }, [viewMode, brands.length]);

  // Search handler — require at least one filter
  const handleSearch = useCallback(async (params: Record<string, string>) => {
    if (Object.keys(params).length === 0) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`/api/stock?${qs}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur serveur" }));
        throw new Error(err.error || "Erreur");
      }
      const data = await res.json();
      setStock(data);
      setSearched(true);
    } catch (e) {
      console.error("Stock search error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load stock by category
  const handleSelectFamille = useCallback(async (famille: Famille) => {
    setSelectedFamille(famille);
    setLoading(true);
    try {
      const rayon = rayons.find((r) => r.RAY_ID === famille.FAM_RAYID);
      const params: Record<string, string> = {};
      if (rayon) params.rayon = rayon.RAY_NOM;
      params.famille = famille.FAM_NOM;
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`/api/stock?${qs}`);
      if (!res.ok) throw new Error("Erreur");
      setStock(await res.json());
      setSearched(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [rayons]);

  // Load stock by brand
  const handleSelectBrand = useCallback(async (marque: string) => {
    setSelectedBrand(marque);
    setLoading(true);
    try {
      const res = await fetch(`/api/stock?marque=${encodeURIComponent(marque)}`);
      if (!res.ok) throw new Error("Erreur");
      setStock(await res.json());
      setSearched(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset when switching modes
  const switchMode = (mode: ViewMode) => {
    setViewMode(mode);
    setStock([]);
    setSearched(false);
    setSelectedRayon(null);
    setSelectedFamille(null);
    setSelectedBrand(null);
    setBrandSearch("");
  };

  const totalQte = stock.reduce((s, r) => s + (r.STOCK_TOTAL || 0), 0);
  const totalValor = stock.reduce((s, r) => s + (r.VALORISATION || 0), 0);

  // Filtered brands for search
  const filteredBrands = brandSearch.trim()
    ? brands.filter((b) => b.MARQUE.toUpperCase().includes(brandSearch.toUpperCase()))
    : brands;

  // Category breadcrumb
  const filteredFamilles = selectedRayon
    ? familles.filter((f) => f.FAM_RAYID === selectedRayon.RAY_ID)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Consultation stock</h1>
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
          {([
            { key: "search" as ViewMode, label: "Recherche", icon: "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" },
            { key: "categories" as ViewMode, label: "Catégories", icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" },
            { key: "brands" as ViewMode, label: "Marques", icon: "M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z" },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => switchMode(tab.key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                viewMode === tab.key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== SEARCH MODE ===== */}
      {viewMode === "search" && (
        <SearchBar
          onSearch={handleSearch}
          placeholder="Rechercher par nom ou référence..."
        />
      )}

      {/* ===== CATEGORIES MODE ===== */}
      {viewMode === "categories" && !selectedFamille && (
        <>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <button
              onClick={() => { setSelectedRayon(null); setSelectedFamille(null); }}
              className={`hover:text-blue-600 ${!selectedRayon ? "font-bold text-gray-900" : "hover:underline"}`}
            >
              Rayons
            </button>
            {selectedRayon && (
              <>
                <span>/</span>
                <span className="font-bold text-gray-900">{selectedRayon.RAY_NOM}</span>
              </>
            )}
          </nav>

          {catsLoading && (
            <div className="py-10 text-center text-gray-500">Chargement...</div>
          )}

          {/* Rayons */}
          {!catsLoading && !selectedRayon && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {rayons.map((rayon) => (
                <button
                  key={rayon.RAY_ID}
                  onClick={() => setSelectedRayon(rayon)}
                  className="rounded-xl border bg-white p-5 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md glass-card"
                >
                  <h3 className="font-semibold text-gray-900">{rayon.RAY_NOM}</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {rayon.familleCount} famille{rayon.familleCount > 1 ? "s" : ""}
                    {" · "}
                    {rayon.articleCount} article{rayon.articleCount > 1 ? "s" : ""}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Familles */}
          {!catsLoading && selectedRayon && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filteredFamilles.map((famille) => (
                <button
                  key={famille.FAM_ID}
                  onClick={() => handleSelectFamille(famille)}
                  className="rounded-xl border bg-white p-5 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md glass-card"
                >
                  <h3 className="font-semibold text-gray-900">{famille.FAM_NOM}</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {famille.articleCount} article{famille.articleCount > 1 ? "s" : ""}
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
        </>
      )}

      {/* Back button when viewing category results */}
      {viewMode === "categories" && selectedFamille && (
        <button
          onClick={() => { setSelectedFamille(null); setStock([]); setSearched(false); }}
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          {selectedRayon?.RAY_NOM} / {selectedFamille.FAM_NOM}
        </button>
      )}

      {/* ===== BRANDS MODE ===== */}
      {viewMode === "brands" && !selectedBrand && (
        <>
          {/* Search brands */}
          <div className="relative max-w-md">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Filtrer les marques..."
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {brandsLoading && (
            <div className="py-10 text-center text-gray-500">Chargement...</div>
          )}

          {!brandsLoading && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredBrands.map((brand) => (
                <button
                  key={brand.MARQUE}
                  onClick={() => handleSelectBrand(brand.MARQUE)}
                  className="flex items-center gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md glass-card"
                >
                  <BrandLogo name={brand.MARQUE} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-gray-900">{brand.MARQUE}</h3>
                    <p className="text-xs text-gray-500">
                      {brand.NB_ARTICLES} art. · {brand.STOCK_TOTAL} pcs
                    </p>
                  </div>
                </button>
              ))}
              {filteredBrands.length === 0 && (
                <div className="col-span-full py-10 text-center text-gray-500">
                  Aucune marque trouvée.
                </div>
              )}
            </div>
          )}

          {!brandsLoading && filteredBrands.length > 0 && (
            <p className="text-sm text-gray-400">
              {filteredBrands.length} marque{filteredBrands.length > 1 ? "s" : ""} en stock
            </p>
          )}
        </>
      )}

      {/* Back button when viewing brand results */}
      {viewMode === "brands" && selectedBrand && (
        <button
          onClick={() => { setSelectedBrand(null); setStock([]); setSearched(false); }}
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          <BrandLogo name={selectedBrand} size="sm" />
          {selectedBrand}
        </button>
      )}

      {/* ===== RESULTS TABLE ===== */}
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
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {s.ART_NOM}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {s.ART_REFMRK}
                  </TableCell>
                  <TableCell>
                    {s.MARQUE && (
                      <div className="flex items-center gap-2">
                        <BrandLogo name={s.MARQUE} size="sm" />
                        <Badge variant="secondary">{s.MARQUE}</Badge>
                      </div>
                    )}
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
