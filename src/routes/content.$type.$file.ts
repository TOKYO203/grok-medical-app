import { createFileRoute } from "@tanstack/react-router";
import {
  isProtectedFamily,
  readAllProtectedAssets,
  readProtectedAsset,
  type ProtectedFamily,
} from "@/lib/content/protected-assets.server";
import { sanitizeQuizAsset, type QuizFamily } from "@/lib/content/quiz-sanitize.server";
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
 *
 * Pentest P2 : pour les familles QCM (`decks`, `diagnostics`), la projection
 * servie est SANITISÉE — ni `correct` ni `explanation` ne quittent le serveur ;
 * la correction se fait par `POST /api/quiz/answer`.
 */

/**
 * Familles servies aussi en catalogue groupé `_catalog.json`.
 * Pentest §1/§14/§15 : le client charge l'index public (projections), puis
 * complète par ces catalogues sous jeton — un seul aller-retour par famille.
 */
const GROUPED_FAMILIES = new Set<ProtectedFamily>(["signes", "decks", "cases", "diagnostics"]);

/** Familles QCM : la grille de correction ne quitte jamais le serveur (P2). */
const SERVER_SCORED_FAMILIES = new Set<ProtectedFamily>(["decks", "diagnostics"]);

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

/** Projection servie au client : sanitisation des familles QCM, tel quel sinon. */
function projectAsset(family: ProtectedFamily, asset: unknown): unknown {
  return SERVER_SCORED_FAMILIES.has(family)
    ? sanitizeQuizAsset(family as QuizFamily, asset)
    : asset;
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

        // Catalogues groupés (signes, decks, cas, diagnostics) : une requête
        // pour toute la famille au lieu d'un aller-retour par fiche.
        const isCatalog = GROUPED_FAMILIES.has(family) && file === "_catalog.json";
        if (!isCatalog && !/^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*\.json$/.test(file)) {
          return notFoundResponse();
        }

        // Garde : jeton de contenu obligatoire, avant toute lecture d'actif.
        const auth = await authenticate(request);
        if (!auth.ok) {
          return auth.reason === "unconfigured" ? contentUnavailableResponse() : unauthorizedResponse();
        }

        if (isCatalog) {
          if (family === "signes") {
            return jsonResponse(await buildSignesCatalog(), 200, {
              "Cache-Control": "private, max-age=60",
            });
          }
          // Pentest §1/§14/§15 : decks Pro, cas cliniques Pro et démarches,
          // regroupés dans UNE réponse privée (jamais de cache partagé).
          // Pentest P2 : familles QCM sanitisiées (pas de correct/explanation).
          const assets = await readAllProtectedAssets(family);
          return jsonResponse(
            {
              schemaVersion: 1,
              items: Object.values(assets).map((value) => projectAsset(family, value)),
            },
            200,
            { "Cache-Control": "private, max-age=60" },
          );
        }

        const asset = await readProtectedAsset(family, file);
        if (asset === undefined) return notFoundResponse();

        return jsonResponse(projectAsset(family, asset), 200);
      },
    },
  },
});
