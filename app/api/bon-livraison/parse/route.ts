import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// Read the API key from .dashclaude-data.json
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

const PARSE_PROMPT = `Tu es un assistant spécialisé dans la lecture de bons de livraison / dispatch notes.

Analyse ce document PDF et extrais TOUTES les informations structurées.

Retourne UNIQUEMENT un JSON valide (pas de markdown, pas de commentaire) avec cette structure exacte :

{
  "deliveryNotes": [
    {
      "noteNumber": "numéro du bon de livraison",
      "orderNumber": "numéro de commande",
      "createdDate": "date de création",
      "customerRef": "référence client si présente",
      "supplier": "nom du fournisseur/expéditeur (ex: BESTSELLER)",
      "brand": "marque des articles (ex: JACK & JONES)",
      "totalPieces": 0,
      "totalBoxes": 0,
      "articles": [
        {
          "styleNo": "numéro de style (ex: 12081832)",
          "styleName": "nom du style (ex: SENSE TRUNKS 3-PACK NOOS)",
          "colours": [
            {
              "colour": "nom de la couleur",
              "variantName": "nom de la variante si présent",
              "sizes": [
                { "size": "S", "qty": 2 },
                { "size": "M", "qty": 1 }
              ],
              "total": 3
            }
          ],
          "totalPieces": 0
        }
      ]
    }
  ]
}

Règles importantes :
- Inclus CHAQUE article et CHAQUE coloris/taille du document
- Les quantités doivent être des nombres entiers
- Si un article apparaît sur plusieurs pages, regroupe-le
- TAILLES JEANS / PANTALONS : quand le tableau a une colonne "Length" (longueur de jambe), les tailles doivent combiner le numéro de colonne (tour de taille) avec la longueur au format "TAILLE/LONGUEUR". Exemple : colonne "29" + Length "32" → size = "29/32". Colonne "30" + Length "30" → size = "30/30". Chaque combinaison couleur + longueur = une entrée séparée dans "colours" avec le champ "colour" = "CouleurNom (L32)" par exemple.
- Pour les articles SANS colonne Length (t-shirts, sous-vêtements, etc.), utilise les tailles telles quelles (S, M, L, XL, XXL, etc.)
- Le champ "brand" doit être la marque des articles, pas le fournisseur
- Retourne UNIQUEMENT le JSON, rien d'autre`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Le fichier doit être un PDF" },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const apiKey = getApiKey();

    // Call Claude API with PDF document
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64,
                },
              },
              {
                type: "text",
                text: PARSE_PROMPT,
              },
            ],
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
    const textContent = result.content?.find(
      (c: { type: string }) => c.type === "text"
    );

    if (!textContent?.text) {
      return NextResponse.json(
        { error: "Réponse vide de l'API Claude" },
        { status: 502 }
      );
    }

    // Parse the JSON response from Claude
    let parsed;
    try {
      // Try to extract JSON if wrapped in markdown code block
      let jsonStr = textContent.text.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1].trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse Claude response:", textContent.text);
      return NextResponse.json(
        { error: "Impossible de parser la réponse de Claude" },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Error parsing delivery note:", error);
    const msg =
      error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
