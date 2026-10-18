import { createFileRoute } from "@tanstack/react-router";
import {
  isProtectedFamily,
  readAllProtectedAssets,
  readProtectedAsset,
  type ProtectedFamily,
} from "@/lib/content/protected-assets.server";
import { pathologyEntry } from "@/lib/pathologies/manifest";
import {
  authenticate,
  contentUnavailableResponse,
  jsonResponse,
  unauthorizedResponse,
} from "@/server/content-guard";
import type { SigneCategory } from "@/core/signes/types";

/**
 * `/content/$type/$file` — GUICHET UNIQUE du contenu Premium.
 *
 * Avant ce chantier, `public/content/**` était publié tel quel : n'importe qui
 * pouvait récupérer une fiche avec `curl`, et le verrouillage Premium côté
 * React ne protégeait rien. Les actifs vivent maintenant dans
 * `private/content/**`, HORS du dossier publié, et cette route est le seul
 * moyen de les lire.
 *
 * Règles :
 *   • `pathologies` et `signes` exigent `Authorization: Bearer <jwt>` valide ;
 *   • `previews` est PUBLIC et ne rend qu'une PROJECTION (titre, objectif,
 *     intitulés de sections) : de quoi teaser une fiche, jamais de quoi la lire ;
 *   • toute réponse autorisée part en `Cache-Control: private` + `Vary:
 *     Authorization, Cookie` — sinon un cache intermédiaire resservirait le 200
 *     d'un client autorisé à un visiteur anonyme.
 *
 * `_catalog.json` (signes) est un acteur à part : une seule requête rend les
 * 110 fiches, ce qui évite 110 allers-retours vers la fonction serveur.
 */

/** Ordre éditorial des catégories « Signes » (le manifeste n'est pas lisible ici). */
const SIGNE_CATEGORY_ORDER: SigneCategory[] = [
  "syndrome",
  "triade",
  "tetrade",
  "signe",
  "symptome",
];

function notFoundResponse(): Response {
  return jsonResponse({ error: "not_found" }, 404);
}

/**
 * Projection publique d'une fiche : ce qu'on accepte de montrer pour donner
 * envie. Aucun contenu médical rédigé (pas de section, pas de flashcard, pas de
 * carte mentale, pas de liste de signes).
 */
async function previewProjection(
  type: string,
  id: string,
): Promise<Record<string, unknown> | undefined> {
  if (type === "pathologies" || type === "pathologie") {
    const entry = pathologyEntry(id);
    if (!entry || entry.status !== "available") return undefined;
    const raw = await readProtectedAsset("pathologies", entry.file);
    if (!raw || typeof raw !== "object") return undefined;
    const content = raw as {
      slug?: unknown;
      title?: unknown;
      subtitle?: unknown;
      objective?: unknown;
      sections?: { title?: unknown }[];
    };
    if (typeof content.title !== "string") return undefined;
    return {
      slug: typeof content.slug === "string" ? content.slug : entry.slug,
      title: content.title,
      subtitle: typeof content.subtitle === "string" ? content.subtitle : undefined,
      objective: typeof content.objective === "string" ? content.objective : undefined,
      sectionTitles: Array.isArray(content.sections)
        ? content.sections.flatMap((section) =>
            typeof section?.title === "string" ? [section.title] : [],
          )
        : [],
      premium: true,
    };
  }

  if (type === "signes") {
    const raw = await readProtectedAsset("signes", `${id}.json`);
    if (!raw || typeof raw !== "object") return undefined;
    const item = raw as { id?: unknown; category?: unknown; question?: unknown };
    if (typeof item.id !== "string") return undefined;
    return {
      id: item.id,
      category: typeof item.category === "string" ? item.category : undefined,
      question: typeof item.question === "string" ? item.question : undefined,
      premium: true,
    };
  }

  return undefined;
}

/** Catalogue groupé des 110 cas, dans l'ordre éditorial des catégories. */
async function buildSignesCatalog() {
  const assets = await readAllProtectedAssets("signes");
  const items = Object.values(assets).filter(
    (value): value is Record<string, unknown> =>
      value !== null && typeof value === "object" && typeof (value as { id?: unknown }).id === "string",
  );

  const rank = (value: Record<string, unknown>) => {
    const index = SIGNE_CATEGORY_ORDER.indexOf(value.category as SigneCategory);
    return index === -1 ? SIGNE_CATEGORY_ORDER.length : index;
  };

  items.sort((a, b) => {
    const byCategory = rank(a) - rank(b);
    if (byCategory !== 0) return byCategory;
    return String(a.id).localeCompare(String(b.id));
  });

  return { schemaVersion: 1, items };
}

export const Route = createFileRoute("/content/$type/$file")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const type = String(params.type ?? "");
        const file = String(params.file ?? "");

        // Aperçus PUBLICs : servis sans jeton, projetés depuis le contenu privé.
        if (type === "previews") {
          const id = file.replace(/\.json$/, "");
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return notFoundResponse();

          const preview =
            (await previewProjection("pathologies", id)) ??
            (await previewProjection("signes", id));
          if (!preview) return notFoundResponse();

          return jsonResponse(preview, 200, {
            "Cache-Control": "public, max-age=60, s-maxage=300",
          });
        }

        if (!isProtectedFamily(type)) return notFoundResponse();

        const family = type as ProtectedFamily;

        // Catalogue groupé « Signes » : une requête pour tout le catalogue.
        const isCatalog = family === "signes" && file === "_catalog.json";
        if (!isCatalog && !/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(file)) {
          return notFoundResponse();
        }

        // Garde : jeton de contenu obligatoire, avant toute lecture d'actif.
        const auth = await authenticate(request);
        if (!auth.ok) {
          return auth.reason === "unconfigured" ? contentUnavailableResponse() : unauthorizedResponse();
        }

        if (isCatalog) {
          return jsonResponse(await buildSignesCatalog(), 200, {
            "Cache-Control": "private, max-age=60",
          });
        }

        const asset = await readProtectedAsset(family, file);
        if (asset === undefined) return notFoundResponse();

        return jsonResponse(asset, 200);
      },
    },
  },
});
