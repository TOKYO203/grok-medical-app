#!/usr/bin/env node
/**
 * Garde-fou du pentest 2026-11-09 (plan de remédiation P2) : la grille de
 * correction des QCM premium ne doit JAMAIS quitter le serveur avant la
 * réponse de l'utilisateur.
 *
 * Vérifie par contrat de source :
 *   1. la route de contenu sanitise les familles QCM (decks, diagnostics) ;
 *   2. le module de sanitisation retire bien `correct` et `explanation` ;
 *   3. la route /api/quiz/answer applique quota PUIS garde PUIS lecture —
 *     jamais de lecture d'actif avant authentification ;
 *   4. les lecteurs clients (quiz-player, démarches) passent par la route
 *     serveur au lieu d'une comparaison locale quand la clé est absente ;
 *   5. les types déclarent `correct`/`explanation` comme optionnels.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CHECKOUT = join(fileURLToPath(import.meta.url), "..", "..");
/**
 * Résolution tolérante : pendant l'incident #476-#483, la route
 * /api/quiz/answer est désactivée côté main (renommée .disabled). Le contrat
 * de source porte sur le CONTENU du module, pas sur son nom : on retombe sur
 * le fichier .disabled s'il existe, sans jamais réactiver la route ici.
 */
const readSource = (path) => {
  try {
    return readFileSync(join(CHECKOUT, path), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return readFileSync(join(CHECKOUT, `${path}.disabled`), "utf8");
    }
    throw error;
  }
};

test("la route de contenu sanitise les familles QCM (decks, diagnostics)", () => {
  const route = readSource("src/routes/content.$type.$file.ts");
  assert.ok(
    route.includes('SERVER_SCORED_FAMILIES = new Set<ProtectedFamily>(["decks", "diagnostics"])'),
    "la liste des familles corrigées côté serveur doit couvrir decks et diagnostics",
  );
  assert.ok(
    route.includes("sanitizeQuizAsset"),
    "la route de contenu doit appliquer sanitizeQuizAsset",
  );
  // Catalogue groupé ET fichier individuel passent par la projection.
  const catalogSanitized = /items: Object\.values\(assets\)\.map\(\(value\) => projectAsset\(family, value\)\)/.test(route);
  assert.ok(catalogSanitized, "le catalogue groupé doit servir les actifs sanitises");
  assert.ok(
    route.includes("return jsonResponse(projectAsset(family, asset), 200);"),
    "le fichier individuel doit servir l'actif sanitise",
  );
});

test("le module de sanitisation retire correct et explanation", () => {
  const sanitizer = readSource("src/lib/content/quiz-sanitize.server.ts");
  assert.ok(
    /const \{ correct: _correct, explanation: _explanation, \.\.\.rest \} = entry;/.test(sanitizer),
    "les deux champs de correction doivent être retirés par déstructuration",
  );
  assert.ok(
    sanitizer.includes('family === "decks" ? sanitizeDeckAsset(asset) : sanitizeDiagnosticAsset(asset)'),
    "l'aiguillage par famille doit couvrir decks et diagnostics",
  );
});

test("/api/quiz/answer applique quota, garde, puis lecture — jamais l'inverse", () => {
  const route = readSource("src/routes/api.quiz.answer.ts");
  // Ancrage sur les SITES D'APPEL (après "POST: async") : les imports en tête
  // de fichier mentionnent les mêmes symboles et faussaient l'ordre.
  const handler = route.slice(route.indexOf("POST: async"));
  const idxRate = handler.indexOf("await rateLimitRequest(");
  const idxAuth = handler.indexOf("await authenticate(request)");
  const idxRead = handler.indexOf("readAllProtectedAssets(family");
  assert.ok(idxRate > -1 && idxAuth > -1 && idxRead > -1, "quota, garde et lecture doivent exister");
  assert.ok(idxRate < idxAuth, "le quota doit précéder l'authentification");
  assert.ok(idxAuth < idxRead, "aucune lecture d'actif avant authentification (fail closed)");
  assert.ok(
    route.includes('ANSWERABLE_FAMILIES = new Set<string>(["decks", "diagnostics"])'),
    "seules les familles QCM sont corrigeables",
  );
  assert.ok(
    route.includes('return json({ error: "not_found" }, 404);'),
    "item ou question introuvable => 404, jamais la grille entière",
  );
  assert.ok(
    route.includes('"Cache-Control": "no-store"'),
    "la correction ne doit jamais être mise en cache",
  );
});

test("les lecteurs clients passent par la correction serveur pour le contenu premium", () => {
  const player = readSource("src/components/quiz-player.tsx");
  assert.ok(
    player.includes('"/api/quiz/answer"'),
    "quiz-player doit corriger via /api/quiz/answer quand la clé locale est absente",
  );
  assert.ok(
    player.includes("fetchWithAuth"),
    "quiz-player doit joindre le jeton de contenu via fetchWithAuth",
  );
  assert.ok(
    player.includes("q.correct !== undefined"),
    "quiz-player doit conserver le chemin local pour les decks gratuits (clé présente)",
  );
  assert.ok(
    player.includes("Réessayer"),
    "quiz-player doit proposer de réessayer après un échec de vérification",
  );

  const demarche = readSource("src/routes/demarche.$id.tsx");
  assert.ok(
    demarche.includes('"/api/quiz/answer"'),
    "la page démarche doit corriger via /api/quiz/answer pour les étapes premium",
  );
  assert.ok(
    demarche.includes('family: "diagnostics"'),
    "la page démarche doit cibler la famille diagnostics",
  );
});

test("les types déclarent la grille de correction comme optionnelle", () => {
  const types = readSource("src/core/types.ts");
  const questionBlock = types.slice(types.indexOf("export type Question"), types.indexOf("export type Chapter"));
  assert.ok(
    questionBlock.includes("correct?: number;") && questionBlock.includes("explanation?: string;"),
    "Question.correct/explanation doivent être optionnels (absents en premium)",
  );
  const stepBlock = types.slice(types.indexOf("export type DiagnosticStep"), types.indexOf("export type DiagnosticCase"));
  assert.ok(
    stepBlock.includes("correct?: number;") && stepBlock.includes("explanation?: string;"),
    "DiagnosticStep.correct/explanation doivent être optionnels (absents en premium)",
  );
});
