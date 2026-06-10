"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface StockItem {
  TAILLE: string;
  COULEUR: string;
  COULEUR_CODE: string | null;
  COULEUR_ARTID: number | null;
  QTE: number;
  PRIX_ACHAT: number;
}

interface ArticleDetail {
  ART_ID: number;
  ART_NOM: string;
  ART_REFMRK: string;
  ART_CODE: string;
  ART_CODEFOURN: string;
  REF_GINKOIA: string;
  MARQUE: string;
  RAYON: string;
  FAMILLE: string;
  SOUS_FAMILLE: string;
  GENRE: string;
  CLASSEMENT: string;
  collections: string[];
  barcodes: string[];
  stock: StockItem[];
}

interface Vente {
  SOURCE: string;
  DATE_VENTE: string;
  NUMERO: string;
  NOM: string;
  QTE: number;
  PXBRUT: number;
  REMISE: number;
  PXNET: number;
  TAILLE: string;
  COULEUR: string;
}

interface Reception {
  BRE_DATE: string;
  BRE_NUMERO: string;
  BRE_NUMFOURN: string;
  FOU_NOM: string;
  BRL_QTE: number;
  BRL_PXACHAT: number;
  BRL_PXVENTE: number;
  TAILLE: string;
  COULEUR: string;
}

function formatDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("fr-FR");
}

function formatEuro(n: number | null) {
  if (n == null) return "-";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " \u20ac";
}

// Build Sport2000 CDN photo URL
// ART_REFMRK may contain color suffix: "1162011 BWHT" or "M9166C-001"
// COU_CODE can be a short code ("BWHT","001") → included in URL
// or a descriptive name ("BLANC NOIR") → not included in URL
function buildPhotoUrl(marque: string, refmrk: string, couCode: string): string {
  // CDN uses short brand name (e.g. "PUMA" not "PUMA ACC DOBOTEX")
  const m = encodeURIComponent(marque.trim().split(/\s+/)[0]);
  const code = couCode.trim();
  let ref = refmrk.trim();
  // Strip trailing COU_CODE after space or hyphen
  if (code && ref.endsWith(code)) {
    ref = ref.slice(0, ref.length - code.length).replace(/[\s-]+$/, "");
  }
  // Short codes (no space) go in URL; descriptive names (with space) don't
  const isCodeShort = code && !code.includes(" ");
  if (isCodeShort) {
    return `https://media.sport2000.fr/photos_plateforme_digitale/${m}/app-${ref}-${code}-p.jpg`;
  }
  return `https://media.sport2000.fr/photos_plateforme_digitale/${m}/app-${ref}-p.jpg`;
}

interface ColorGroup {
  couCode: string | null;
  couArtId: number | null;
  tailles: Map<string, { qte: number; pump: number }>;
  totalQte: number;
}

// Group stock by color for visual display
function groupStockByColor(stock: StockItem[]) {
  const map = new Map<string, ColorGroup>();
  for (const s of stock) {
    const color = s.COULEUR || "Sans couleur";
    if (!map.has(color)) {
      map.set(color, {
        couCode: s.COULEUR_CODE,
        couArtId: s.COULEUR_ARTID,
        tailles: new Map(),
        totalQte: 0,
      });
    }
    const entry = map.get(color)!;
    entry.totalQte += s.QTE || 0;
    if (s.COULEUR_CODE && !entry.couCode) entry.couCode = s.COULEUR_CODE;
    const taille = s.TAILLE || "-";
    const existing = entry.tailles.get(taille);
    if (existing) {
      existing.qte += s.QTE || 0;
    } else {
      entry.tailles.set(taille, { qte: s.QTE || 0, pump: s.PRIX_ACHAT || 0 });
    }
  }
  return map;
}

// Placeholder SVG for broken images
function PhotoPlaceholder({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-gray-100 ${className || ""}`}>
      <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
      </svg>
    </div>
  );
}

// Product photo with fallback
function ProductPhoto({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return <PhotoPlaceholder className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setErrored(true)}
    />
  );
}

export default function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [receptions, setReceptions] = useState<Reception[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("ventes");
  const [ventesLoading, setVentesLoading] = useState(false);
  const [ventesFetched, setVentesFetched] = useState(false);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsFetched, setRecsFetched] = useState(false);

  useEffect(() => {
    fetch(`/api/articles/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Article non trouv\u00e9");
        return r.json();
      })
      .then(setArticle)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (activeTab === "ventes" && !ventesFetched && !ventesLoading) {
      setVentesLoading(true);
      fetch(`/api/articles/${id}/ventes`)
        .then((r) => r.json())
        .then(setVentes)
        .catch(console.error)
        .finally(() => { setVentesLoading(false); setVentesFetched(true); });
    }
    if (activeTab === "receptions" && !recsFetched && !recsLoading) {
      setRecsLoading(true);
      fetch(`/api/articles/${id}/receptions`)
        .then((r) => r.json())
        .then(setReceptions)
        .catch(console.error)
        .finally(() => { setRecsLoading(false); setRecsFetched(true); });
    }
  }, [activeTab, id, ventesFetched, recsFetched, ventesLoading, recsLoading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm text-gray-500">Chargement de la fiche...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="space-y-4">
        <Link href="/articles" className="text-sm text-indigo-600 hover:underline">
          &larr; Retour aux articles
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          {error || "Article non trouv\u00e9"}
        </div>
      </div>
    );
  }

  const totalStock = article.stock.reduce((s, r) => s + (r.QTE || 0), 0);
  const totalValor = article.stock.reduce((s, r) => s + (r.QTE || 0) * (r.PRIX_ACHAT || 0), 0);
  const avgPump = totalStock > 0 ? totalValor / totalStock : 0;
  const stockByColor = groupStockByColor(article.stock);
  const nbTailles = new Set(article.stock.map((s) => s.TAILLE).filter(Boolean)).size;

  // Main photo URL (first color code available)
  const firstCouCode = article.stock.find((s) => s.COULEUR_CODE)?.COULEUR_CODE;
  const mainPhotoUrl = article.MARQUE && article.ART_REFMRK && firstCouCode
    ? buildPhotoUrl(article.MARQUE, article.ART_REFMRK, firstCouCode)
    : null;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/articles" className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 transition-colors">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Retour aux articles
      </Link>

      {/* ===== HERO SECTION ===== */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col sm:flex-row">
          {/* Product photo */}
          <div className="sm:w-56 sm:min-h-56 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-gray-100">
            {mainPhotoUrl ? (
              <ProductPhoto
                src={mainPhotoUrl}
                alt={article.ART_NOM}
                className="h-full w-full object-contain p-4"
              />
            ) : (
              <PhotoPlaceholder className="h-full w-full min-h-[14rem]" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 p-6">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {article.MARQUE && (
                <Link
                  href={`/marques/${encodeURIComponent(article.MARQUE)}`}
                  className="rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-200 transition-colors"
                >
                  {article.MARQUE}
                </Link>
              )}
              {article.GENRE && (
                <span className="rounded-full bg-gray-100 px-3 py-0.5 text-xs font-medium text-gray-600">
                  {article.GENRE}
                </span>
              )}
              {article.RAYON && (
                <span className="rounded-full bg-gray-100 px-3 py-0.5 text-xs font-medium text-gray-600">
                  {article.RAYON}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{article.ART_NOM}</h1>
            <p className="mt-1 text-sm text-gray-500">
              <span className="font-mono">{"Réf: "}{article.ART_REFMRK || "-"}</span>
              {article.REF_GINKOIA && (
                <span className="mx-2 text-gray-300">|</span>
              )}
              {article.REF_GINKOIA && (
                <span className="font-mono">{"Chrono: "}{article.REF_GINKOIA}</span>
              )}
            </p>
            {article.collections.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {article.collections.map((c, i) => (
                  <Badge key={i} variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-xs">
                    {c}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== STATS ROW ===== */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 flex-shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">Stock</p>
              <p className={`text-2xl font-bold ${totalStock > 0 ? "text-emerald-600" : "text-gray-300"}`}>
                {totalStock}
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
              <p className="text-lg font-bold text-gray-900">{formatEuro(totalValor)}</p>
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
              <p className="text-xs font-medium text-gray-400">PUMP</p>
              <p className="text-lg font-bold text-gray-900">{formatEuro(avgPump)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 flex-shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400">Couleurs / Tailles</p>
              <p className="text-lg font-bold text-gray-900">
                {stockByColor.size} / {nbTailles}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== INFORMATIONS SECTION ===== */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Informations</h2>
          <div className="flex-1 border-t border-gray-200" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 mb-4">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                </svg>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{"Références"}</h3>
              </div>
              <dl className="space-y-2.5 text-sm">
                {[
                  ["Réf. marque", article.ART_REFMRK],
                  ["Chrono Ginkoia", article.REF_GINKOIA],
                  ["Code", article.ART_CODE],
                  ["Code fournisseur", article.ART_CODEFOURN],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="font-mono font-medium text-gray-900">{value || "-"}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 mb-4">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
                </svg>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Classification</h3>
              </div>
              <dl className="space-y-2.5 text-sm">
                {[
                  ["Rayon", article.RAYON],
                  ["Famille", article.FAMILLE],
                  ["Sous-famille", article.SOUS_FAMILLE],
                  ["Classement", article.CLASSEMENT],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="font-medium text-gray-900">{value || "-"}</dd>
                  </div>
                ))}
              </dl>
              {article.collections.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Saisons</p>
                  <div className="flex flex-wrap gap-1.5">
                    {article.collections.map((c, i) => (
                      <Badge key={i} variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-xs">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ===== DECLINAISONS COULEURS ===== */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
          </svg>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">{"Déclinaisons couleurs"}</h2>
          <div className="flex-1 border-t border-gray-200" />
        </div>

        {stockByColor.size === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center text-gray-400">
              {"Aucune donnée de stock"}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {Array.from(stockByColor.entries()).map(([color, data]) => {
              const colorPhotoUrl = article.MARQUE && article.ART_REFMRK && data.couCode
                ? buildPhotoUrl(article.MARQUE, article.ART_REFMRK, data.couCode)
                : null;

              return (
                <Card key={color} className="border-0 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between border-b bg-gray-50/50 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500" />
                      <span className="text-sm font-semibold text-gray-800">{color}</span>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      data.totalQte > 0
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-400"
                    }`}>
                      {data.totalQte} pcs
                    </span>
                  </div>
                  <CardContent className="px-5 py-3">
                    <div className="flex gap-4">
                      {/* Color-specific photo */}
                      {colorPhotoUrl && (
                        <div className="hidden sm:block w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border border-gray-100">
                          <ProductPhoto
                            src={colorPhotoUrl}
                            alt={`${article.ART_NOM} - ${color}`}
                            className="h-full w-full object-contain"
                          />
                        </div>
                      )}
                      {/* Size grid */}
                      <div className="flex flex-wrap gap-2 flex-1">
                        {Array.from(data.tailles.entries()).map(([taille, info]) => (
                          <div
                            key={taille}
                            className={`flex flex-col items-center rounded-lg border px-3 py-2 text-center transition-all ${
                              info.qte > 0
                                ? "border-indigo-200 bg-indigo-50/50"
                                : "border-gray-100 bg-gray-50 opacity-50"
                            }`}
                          >
                            <span className="text-xs text-gray-500">{taille}</span>
                            <span className={`text-sm font-bold ${info.qte > 0 ? "text-indigo-700" : "text-gray-300"}`}>
                              {info.qte}
                            </span>
                            {info.pump > 0 && (
                              <span className="text-[10px] text-gray-400">{info.pump.toFixed(2)}{"€"}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== HISTORIQUE (Ventes / Receptions) ===== */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Historique</h2>
          <div className="flex-1 border-t border-gray-200" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-100/80">
            <TabsTrigger value="ventes" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
              Ventes
            </TabsTrigger>
            <TabsTrigger value="receptions" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
              </svg>
              {"Réceptions"}
            </TabsTrigger>
          </TabsList>

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

          <TabsContent value="receptions" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6">
                {recsLoading ? (
                  <div className="py-10 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                  </div>
                ) : receptions.length === 0 ? (
                  <p className="py-8 text-center text-gray-400">{"Aucune réception trouvée."}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-100">
                          <TableHead className="text-xs uppercase tracking-wider text-gray-400">Date</TableHead>
                          <TableHead className="text-xs uppercase tracking-wider text-gray-400">{"N° BR"}</TableHead>
                          <TableHead className="text-xs uppercase tracking-wider text-gray-400">Fournisseur</TableHead>
                          <TableHead className="text-xs uppercase tracking-wider text-gray-400">Couleur</TableHead>
                          <TableHead className="text-xs uppercase tracking-wider text-gray-400">Taille</TableHead>
                          <TableHead className="text-right text-xs uppercase tracking-wider text-gray-400">{"Qté"}</TableHead>
                          <TableHead className="text-right text-xs uppercase tracking-wider text-gray-400">PA</TableHead>
                          <TableHead className="text-right text-xs uppercase tracking-wider text-gray-400">PV</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {receptions.map((r, i) => (
                          <TableRow key={i} className="border-gray-50 hover:bg-gray-50/50 transition-colors">
                            <TableCell className="text-sm">{formatDate(r.BRE_DATE)}</TableCell>
                            <TableCell className="font-mono text-xs text-gray-500">{r.BRE_NUMERO}</TableCell>
                            <TableCell>
                              <div className="text-sm font-medium">{r.FOU_NOM || "-"}</div>
                              {r.BRE_NUMFOURN && (
                                <div className="font-mono text-[10px] text-gray-400">{r.BRE_NUMFOURN}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              {r.COULEUR ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full bg-violet-400" />
                                  <span className="text-sm">{r.COULEUR}</span>
                                </span>
                              ) : "-"}
                            </TableCell>
                            <TableCell className="text-sm">{r.TAILLE || "-"}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">{r.BRL_QTE}</TableCell>
                            <TableCell className="text-right tabular-nums text-gray-500">{formatEuro(r.BRL_PXACHAT)}</TableCell>
                            <TableCell className="text-right tabular-nums font-semibold text-gray-900">{formatEuro(r.BRL_PXVENTE)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-400">
                      <span>{receptions.length} {"réception"}{receptions.length > 1 ? "s" : ""}</span>
                      <span className="font-medium text-gray-600">
                        {"Total : "}{receptions.reduce((s, r) => s + (r.BRL_QTE || 0), 0)} {"pièces"}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
