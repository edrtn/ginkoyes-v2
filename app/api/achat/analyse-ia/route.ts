import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

function getApiKey(): string {
  try {
    const dataPath = join(process.cwd(), ".dashclaude-data.json");
    const data = JSON.parse(readFileSync(dataPath, "utf-8"));
    const entry = data.find(
      (e: { category: string; key: string }) =>
        e.category === "api" && e.key === "ANTHROPIC_API_KEY"
    );
    if (entry?.value) return entry.value;
  } catch {
    // ignore
  }
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  throw new Error("Clé API Anthropic introuvable");
}

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marque, fromN1, toN1, fromN2, toN2, comparatif, poidsRayon, recap, tauxSortie } = body;

    if (!marque) {
      return NextResponse.json({ error: "Marque requise" }, { status: 400 });
    }

    const apiKey = getApiKey();

    // Format data for prompt
    let recapText = "Non disponible";
    if (recap) {
      recapText = [
        `- Modèles commandés : ${recap.nbModeles}`,
        `- Quantité totale : ${recap.qteTotale} pièces`,
        `- Montant achat brut : ${recap.montantAchatBrut?.toFixed(2)} €`,
        `- Montant achat net : ${recap.montantAchatNet?.toFixed(2)} €`,
        `- Montant vente : ${recap.montantVente?.toFixed(2)} €`,
        `- Coefficient : ${recap.coeff?.toFixed(2)}`,
        `- Marge : ${recap.marge?.toFixed(1)}%`,
        `- Remises : R1=${recap.remise1?.toFixed(1)}% R2=${recap.remise2?.toFixed(1)}% R3=${recap.remise3?.toFixed(1)}%`,
      ].join("\n");
    }

    let comparatifText = "Non disponible";
    if (comparatif) {
      const n1 = comparatif.n1?.total;
      const n2 = comparatif.n2?.total;
      const evol = comparatif.evolution;
      comparatifText = "Période N :\n";
      if (n1) {
        comparatifText += `  CA TTC : ${n1.caTtc?.toFixed(2)} € | CA HT : ${n1.caHt?.toFixed(2)} € | Qté : ${n1.qte} | Marge : ${n1.marge?.toFixed(1)}% | Prix moyen : ${n1.prixMoyen?.toFixed(2)} €\n`;
      }
      comparatifText += "Période N-1 :\n";
      if (n2) {
        comparatifText += `  CA TTC : ${n2.caTtc?.toFixed(2)} € | CA HT : ${n2.caHt?.toFixed(2)} € | Qté : ${n2.qte} | Marge : ${n2.marge?.toFixed(1)}% | Prix moyen : ${n2.prixMoyen?.toFixed(2)} €\n`;
      }
      if (evol) {
        comparatifText += `Évolution : CA ${evol.caTtc >= 0 ? "+" : ""}${evol.caTtc?.toFixed(1)}% | Marge ${evol.marge >= 0 ? "+" : ""}${evol.marge?.toFixed(1)}pts | Qté ${evol.qte >= 0 ? "+" : ""}${evol.qte?.toFixed(1)}% | Prix moyen ${evol.prixMoyen >= 0 ? "+" : ""}${evol.prixMoyen?.toFixed(1)}%\n`;
      }
      if (comparatif.n1?.parGenre?.length) {
        comparatifText += "\nDétail par genre (N) :\n";
        for (const g of comparatif.n1.parGenre) {
          comparatifText += `  ${g.genre} : CA ${g.caTtc?.toFixed(2)} € | Qté ${g.qte} | Marge ${g.marge?.toFixed(1)}%\n`;
        }
      }
      if (comparatif.n2?.parGenre?.length) {
        comparatifText += "Détail par genre (N-1) :\n";
        for (const g of comparatif.n2.parGenre) {
          comparatifText += `  ${g.genre} : CA ${g.caTtc?.toFixed(2)} € | Qté ${g.qte} | Marge ${g.marge?.toFixed(1)}%\n`;
        }
      }
    }

    let poidsText = "Non disponible";
    if (poidsRayon?.n1?.length) {
      poidsText = "Période N :\n";
      for (const p of poidsRayon.n1) {
        const label = p.famille ? `${p.rayon} > ${p.famille}` : p.rayon;
        poidsText += `  ${label} : CA marque ${p.caMarque?.toFixed(2)} € / total ${p.caTotal?.toFixed(2)} € = ${p.partCa?.toFixed(1)}% | Qté ${p.qteMarque}/${p.qteTotal} = ${p.partQte?.toFixed(1)}%\n`;
      }
      if (poidsRayon.n2?.length) {
        poidsText += "Période N-1 :\n";
        for (const p of poidsRayon.n2) {
          const label = p.famille ? `${p.rayon} > ${p.famille}` : p.rayon;
          poidsText += `  ${label} : CA marque ${p.caMarque?.toFixed(2)} € / total ${p.caTotal?.toFixed(2)} € = ${p.partCa?.toFixed(1)}% | Qté ${p.qteMarque}/${p.qteTotal} = ${p.partQte?.toFixed(1)}%\n`;
        }
      }
    }

    let tauxText = "Non disponible";
    if (tauxSortie?.totaux) {
      tauxText = `Taux de sortie global : ${tauxSortie.totaux.tauxSortieMoyen?.toFixed(1)}% (${tauxSortie.totaux.qteVendue} vendus / ${tauxSortie.totaux.qteRecue} reçus)\n`;
      if (tauxSortie.articles?.length) {
        tauxText += `${tauxSortie.articles.length} articles dans la collection.\n`;
        const sorted = [...tauxSortie.articles].sort((a, b) => b.tauxSortie - a.tauxSortie);
        if (sorted.length > 5) {
          tauxText += "Top 5 meilleurs taux de sortie :\n";
          for (const a of sorted.slice(0, 5)) {
            tauxText += `  ${a.nom} (${a.ref}) : ${a.tauxSortie?.toFixed(1)}% (${a.qteVendue}/${a.qteRecue})\n`;
          }
          tauxText += "Top 5 pires taux de sortie :\n";
          for (const a of sorted.slice(-5).reverse()) {
            tauxText += `  ${a.nom} (${a.ref}) : ${a.tauxSortie?.toFixed(1)}% (${a.qteVendue}/${a.qteRecue})\n`;
          }
        }
      }
    }

    const systemPrompt = `Tu es un analyste achat senior spécialisé dans le retail sport/outdoor. Tu travailles pour un magasin de sport indépendant multimarque en France.

Tu as accès à un outil de recherche web. UTILISE-LE OBLIGATOIREMENT pour :
1. Chercher les dernières actualités de la marque ${marque} (nouveaux produits, stratégie, résultats financiers, repositionnement)
2. Identifier les tendances actuelles du marché sport/outdoor en France
3. Observer la concurrence directe de ${marque} (autres marques sur les mêmes segments)

Sources fiables à privilégier : Sport-Guide.com, FashionNetwork, LSA-conso, SportBusiness, sites officiels des marques, rapports sectoriels.`;

    const userPrompt = `Voici les données internes d'analyse pour la marque **${marque}** sur la période ${fromN1} → ${toN1} vs N-1 (${fromN2} → ${toN2}) :

### Récapitulatif collection
${recapText}

### Comparatif ventes N vs N-1
${comparatifText}

### Poids de marché par catégorie
${poidsText}

### Taux de sortie collection
${tauxText}

---

Commence par faire des recherches web sur l'actualité de ${marque} et de ses concurrents directs, puis produis une analyse structurée :

1. **Synthèse des performances** — CA, marge, évolution, performance globale
2. **Contexte marché & actualité ${marque}** — actualités récentes de la marque, tendances du secteur, positionnement stratégique (basé sur tes recherches web)
3. **Analyse concurrentielle** — comparaison avec les marques concurrentes sur les mêmes segments, parts de marché relatives
4. **Positionnement en magasin** — poids dans chaque catégorie, évolution, rayons forts/faibles
5. **Points forts & points de vigilance**
6. **Recommandations achat** — pour la prochaine saison, en tenant compte de l'actualité marché et de la concurrence

Sois factuel, utilise les chiffres internes ET les informations marché. Cite tes sources quand tu utilises des infos web. Écris en français.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 5,
          },
        ],
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Claude API error:", response.status, errBody);
      return NextResponse.json(
        { error: `Erreur API Claude (${response.status})` },
        { status: 502 }
      );
    }

    const result = await response.json();

    // Extract all text blocks from the response
    const textParts: string[] = [];
    if (result.content) {
      for (const block of result.content) {
        if (block.type === "text") {
          textParts.push(block.text);
        }
      }
    }

    const analyse = textParts.join("\n\n");

    if (!analyse) {
      return NextResponse.json(
        { error: "Réponse vide de l'API Claude" },
        { status: 502 }
      );
    }

    return NextResponse.json({ analyse });
  } catch (error) {
    console.error("Error in analyse-ia:", error);
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
