"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

interface ReceptionLine {
  BRL_ID: number;
  BRL_QTE: number;
  BRL_PXACHAT: number;
  BRL_PXVENTE: number;
  ART_ID: number;
  ART_NOM: string;
  ART_REFMRK: string;
  MARQUE: string;
  TAILLE: string;
  COULEUR: string;
  COULEUR_CODE: string;
}

interface ReceptionDetail {
  BRE_ID: number;
  BRE_DATE: string;
  BRE_NUMERO: string;
  BRE_NUMFOURN: string;
  FOU_NOM: string;
  COLLECTION: string | null;
  lines: ReceptionLine[];
}

interface GroupedArticle {
  artId: number;
  nom: string;
  ref: string;
  marque: string;
  pxAchat: number;
  pxVente: number;
  qteTotale: number;
  couleurs: {
    couleur: string;
    couleurCode: string;
    tailles: { taille: string; qte: number }[];
    qteCouleur: number;
  }[];
}

// ── Photo helpers ──────────────────────────────────────

function buildPhotoUrl(marque: string, refmrk: string, couCode: string): string {
  const m = encodeURIComponent(marque.trim().split(/\s+/)[0]);
  const code = couCode.trim();
  let ref = refmrk.trim();
  if (code && ref.endsWith(code)) {
    ref = ref.slice(0, ref.length - code.length).replace(/[\s-]+$/, "");
  }
  const isCodeShort = code && !code.includes(" ");
  if (isCodeShort) {
    return `https://media.sport2000.fr/photos_plateforme_digitale/${m}/app-${ref}-${code}-p.jpg`;
  }
  return `https://media.sport2000.fr/photos_plateforme_digitale/${m}/app-${ref}-p.jpg`;
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

// ── Helpers ────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("fr-FR");
}

function formatEuro(n: number | null) {
  if (n == null) return "-";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €";
}

// ── Component ──────────────────────────────────────────

export default function ReceptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ReceptionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/receptions/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Réception non trouvée");
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Group lines by article → couleur → tailles
  const grouped = useMemo(() => {
    if (!data) return [];
    const map = new Map<number, GroupedArticle>();

    for (const l of data.lines) {
      let art = map.get(l.ART_ID);
      if (!art) {
        art = {
          artId: l.ART_ID,
          nom: l.ART_NOM,
          ref: l.ART_REFMRK,
          marque: l.MARQUE || "",
          pxAchat: l.BRL_PXACHAT,
          pxVente: l.BRL_PXVENTE,
          qteTotale: 0,
          couleurs: [],
        };
        map.set(l.ART_ID, art);
      }

      art.qteTotale += l.BRL_QTE;

      const couleurKey = l.COULEUR || "-";
      let couleurGroup = art.couleurs.find((c) => c.couleur === couleurKey);
      if (!couleurGroup) {
        couleurGroup = { couleur: couleurKey, couleurCode: l.COULEUR_CODE || "", tailles: [], qteCouleur: 0 };
        art.couleurs.push(couleurGroup);
      }

      couleurGroup.qteCouleur += l.BRL_QTE;
      const existingTaille = couleurGroup.tailles.find((t) => t.taille === (l.TAILLE || "-"));
      if (existingTaille) {
        existingTaille.qte += l.BRL_QTE;
      } else {
        couleurGroup.tailles.push({ taille: l.TAILLE || "-", qte: l.BRL_QTE });
      }
    }

    return Array.from(map.values());
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
          <p className="text-sm text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link
          href="/receptions"
          className="inline-flex items-center gap-1 text-sm text-rose-600 hover:text-rose-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Retour aux réceptions
        </Link>
        <div className="py-10 text-center text-red-500">
          {error || "Réception non trouvée"}
        </div>
      </div>
    );
  }

  const totalQte = data.lines.reduce((s, l) => s + (l.BRL_QTE || 0), 0);
  const totalAchat = data.lines.reduce(
    (s, l) => s + (l.BRL_QTE || 0) * (l.BRL_PXACHAT || 0),
    0
  );
  const totalVente = data.lines.reduce(
    (s, l) => s + (l.BRL_QTE || 0) * (l.BRL_PXVENTE || 0),
    0
  );

  return (
    <div className="space-y-6">
      <Link
        href="/receptions"
        className="inline-flex items-center gap-1 text-sm text-rose-600 hover:text-rose-800 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Retour aux réceptions
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          BR {data.BRE_NUMERO}
        </h1>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <span className="text-gray-400 text-xs uppercase tracking-wider">Date</span>
            <p className="font-semibold text-gray-900 mt-0.5">{formatDate(data.BRE_DATE)}</p>
          </div>
          <div>
            <span className="text-gray-400 text-xs uppercase tracking-wider">Fournisseur</span>
            <p className="font-semibold text-gray-900 mt-0.5">{data.FOU_NOM || "-"}</p>
          </div>
          <div>
            <span className="text-gray-400 text-xs uppercase tracking-wider">Réf. fournisseur</span>
            <p className="font-mono font-semibold text-gray-900 mt-0.5">{data.BRE_NUMFOURN || "-"}</p>
          </div>
          <div>
            <span className="text-gray-400 text-xs uppercase tracking-wider">Collection</span>
            <p className="font-semibold text-gray-900 mt-0.5">
              {data.COLLECTION ? (
                <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                  {data.COLLECTION}
                </span>
              ) : "-"}
            </p>
          </div>
          <div>
            <span className="text-gray-400 text-xs uppercase tracking-wider">Articles</span>
            <p className="font-semibold text-gray-900 mt-0.5">{grouped.length} modèles</p>
          </div>
          <div>
            <span className="text-gray-400 text-xs uppercase tracking-wider">Pièces</span>
            <p className="font-semibold text-rose-600 mt-0.5">{totalQte}</p>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-rose-500 to-rose-600 text-white glow-rose">
          <CardContent className="pt-5 pb-4">
            <p className="text-sm font-medium text-rose-100">Quantité totale</p>
            <p className="text-2xl font-bold mt-1">{totalQte} pcs</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-pink-500 to-pink-600 text-white glow-rose">
          <CardContent className="pt-5 pb-4">
            <p className="text-sm font-medium text-pink-100">Montant achat</p>
            <p className="text-2xl font-bold mt-1">{formatEuro(totalAchat)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-fuchsia-500 to-fuchsia-600 text-white glow-rose">
          <CardContent className="pt-5 pb-4">
            <p className="text-sm font-medium text-fuchsia-100">Montant vente</p>
            <p className="text-2xl font-bold mt-1">{formatEuro(totalVente)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Article cards with photos + size grids */}
      <div className="space-y-4">
        {grouped.map((art) => {
          // Build main photo URL from first color code
          const firstCode = art.couleurs.find((c) => c.couleurCode)?.couleurCode || "";
          const mainPhotoUrl = art.marque && art.ref
            ? buildPhotoUrl(art.marque, art.ref, firstCode)
            : null;

          return (
            <Card key={art.artId} className="border shadow-sm overflow-hidden">
              {/* Article header with photo */}
              <div className="flex border-b border-gray-100 bg-gray-50/50">
                {/* Product photo */}
                <div className="w-24 h-24 shrink-0 border-r border-gray-100 bg-white">
                  {mainPhotoUrl ? (
                    <ProductPhoto
                      src={mainPhotoUrl}
                      alt={art.nom}
                      className="h-full w-full object-contain p-2"
                    />
                  ) : (
                    <PhotoPlaceholder className="h-full w-full" />
                  )}
                </div>

                {/* Article info */}
                <div className="flex flex-1 items-center justify-between px-5 py-3 min-w-0">
                  <div className="min-w-0">
                    <Link
                      href={`/articles/${art.artId}`}
                      className="font-semibold text-rose-600 hover:text-rose-800 hover:underline truncate block"
                    >
                      {art.nom}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500">
                        {art.ref}
                      </span>
                      {art.marque && (
                        <span className="rounded bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600">
                          {art.marque}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 text-sm text-gray-500">
                    <span title="Prix achat">PA {formatEuro(art.pxAchat)}</span>
                    <span title="Prix vente">PV {formatEuro(art.pxVente)}</span>
                    <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                      {art.qteTotale} pcs
                    </span>
                  </div>
                </div>
              </div>

              {/* Color rows with photos + size grids */}
              <CardContent className="p-0 divide-y divide-gray-50">
                {art.couleurs.map((coul) => {
                  const colorPhotoUrl = art.marque && art.ref && coul.couleurCode
                    ? buildPhotoUrl(art.marque, art.ref, coul.couleurCode)
                    : null;

                  return (
                    <div key={coul.couleur} className="flex items-center gap-4 px-5 py-3">
                      {/* Color-specific photo (small) */}
                      {colorPhotoUrl && art.couleurs.length > 1 && (
                        <div className="hidden sm:block w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-gray-100 bg-white">
                          <ProductPhoto
                            src={colorPhotoUrl}
                            alt={`${art.nom} - ${coul.couleur}`}
                            className="h-full w-full object-contain p-1"
                          />
                        </div>
                      )}

                      {/* Color label */}
                      <div className="flex items-center gap-2 w-28 shrink-0">
                        <span className="h-3 w-3 rounded-full bg-zinc-300 shrink-0" />
                        <span className="text-sm font-medium text-gray-700 truncate">{coul.couleur}</span>
                        <span className="text-xs text-gray-400">({coul.qteCouleur})</span>
                      </div>

                      {/* Horizontal size tiles */}
                      <div className="flex flex-wrap gap-1.5 flex-1">
                        {coul.tailles.map((t) => (
                          <div
                            key={t.taille}
                            className="flex flex-col items-center rounded-lg border border-rose-200 bg-rose-50/50 px-3 py-1.5 text-center"
                          >
                            <span className="text-[11px] text-gray-500 leading-tight">{t.taille}</span>
                            <span className="text-sm font-bold text-rose-700">{t.qte}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Footer totals */}
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-3 flex items-center justify-between text-sm text-gray-500">
        <span>{grouped.length} article{grouped.length > 1 ? "s" : ""} · {data.lines.length} ligne{data.lines.length > 1 ? "s" : ""}</span>
        <span>
          Qté : {totalQte} | Achat : {formatEuro(totalAchat)} | Vente : {formatEuro(totalVente)}
        </span>
      </div>
    </div>
  );
}
