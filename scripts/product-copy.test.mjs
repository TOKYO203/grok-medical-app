import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/* ============================================================================
   Garde-fous de COPIE PRODUIT.

   Le modèle commercial a changé le 2026-10-20 : on ne vend plus des « Decks » à
   l'unité, des « clés d'activation » ni un accès « à vie », mais un ABONNEMENT
   TRIMESTRIEL lié au compte. Ces tests empêchent le retour de l'ancienne copie
   par copier-coller, et vérifient que le prix n'est jamais écrit en dur.

   La logique d'état d'abonnement (qui décide du TEXTE affiché) est testée à part
   dans src/lib/cloud/subscription.test.ts (module pur exécuté par tsc/node TS).
   ============================================================================ */

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/**
 * Retire les COMMENTAIRES avant d'asserter.
 *
 * Leçon déjà apprise sur ce dépôt (garde-fous `content-assets-cache` et
 * `cloud-auth-gate`) : un test qui lit la source en brut échoue sur sa propre
 * documentation. Or c'est précisément dans les commentaires qu'on EXPLIQUE
 * l'ancien modèle pour éviter qu'il ne revienne — « ne plus écrire Activer ma
 * clé » ne doit pas être interdit.
 *
 * Volontairement simple : les commentaires de bloc et les lignes qui commencent
 * par une double barre oblique — aucun de nos motifs de copie ne contient ces
 * séquences dans une chaîne.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((line) => (line.trimStart().startsWith("//") ? "" : line))
    .join("\n");
}

const readCode = (path) => stripComments(read(path));

test("/tarifs : aucun montant codé en dur, une seule source de prix", () => {
  const tarifs = readCode("src/routes/tarifs.tsx");
  assert.match(tarifs, /PRICES_MGA\.subscriptionQuarter/);
  assert.match(tarifs, /SUBSCRIPTION_MONTHS/);
  // Aucun « 15 000 Ar » / « 3 000 Ar » en dur : le prix vient de pricing.ts.
  assert.doesNotMatch(tarifs, /\b\d{1,3}(?:[ .]\d{3})+\s*Ar\b/);
  assert.doesNotMatch(tarifs, /\b(3_000|27_000|15_000)\b/);
});

test("/tarifs : boutons exclusivement issus du Design System", () => {
  const tarifs = readCode("src/routes/tarifs.tsx");
  assert.match(tarifs, /@\/components\/ui\/ds\/Button"/);
  assert.match(tarifs, /@\/components\/ui\/ds\/Badge"/);
  assert.match(tarifs, /@\/components\/ui\/ds\/Card"/);
  assert.match(tarifs, /@\/components\/ui\/ds\/ButtonLink"/);
  // Aucun <button> natif stylé à la main dans la page.
  assert.doesNotMatch(tarifs, /<button\b/);
});

test("/tarifs : l'abonnement payable passe devant les offres à l'unité", () => {
  const tarifs = readCode("src/routes/tarifs.tsx");

  // 1. Depuis ABO-11 l'abonnement trimestriel est facturé par le MÊME tunnel :
  //    il est annoncé EN PREMIER, avec le bouton de paiement Mobile Money.
  const subscription = tarifs.indexOf('data-tarifs-offer="subscription"');
  const available = tarifs.indexOf('data-tarifs-subscription-state="available"');
  const pay = tarifs.indexOf('data-tarifs-pay="mobile-money"');
  const unit = tarifs.indexOf('data-tarifs-offers="unit"');
  assert.ok(subscription > 0, "carte d'abonnement attendue");
  assert.ok(available > subscription, "l'abonnement doit être marqué disponible");
  assert.ok(pay > subscription, "le paiement Mobile Money vit dans la carte abonnement");
  assert.ok(unit > pay, "les offres à l'unité viennent après l'abonnement");
  assert.match(tarifs, /Payer via Mobile Money/);
  assert.match(tarifs, /Abonnement Trimestriel — Accès Illimité/);

  // 2. Aucun état « bientôt » résiduel pour l'abonnement : ni drapeau, ni
  //    promesse d'être averti. Le seul « Bientôt » restant est le canal carte
  //    bancaire, qui n'est effectivement pas branché.
  assert.doesNotMatch(tarifs, /data-tarifs-subscription-state="soon"/);
  assert.doesNotMatch(tarifs, /data-tarifs-notify/);
  assert.doesNotMatch(tarifs, /Prochainement/);

  // 3. Les prix restent lus dans pricing.ts (une seule source, ABO-2).
  assert.match(tarifs, /PRICES_MGA\.subscriptionQuarter/);
  assert.match(tarifs, /PRICES_MGA\.deck/);
  assert.match(tarifs, /PRICES_MGA\.specialty/);
  assert.match(tarifs, /to="\/pro"/);

  // 4. Les deux canaux restent décrits ; l'international est annoncé et
  //    EXPLICITEMENT désactivé (un bouton mort serait un mensonge de plus).
  assert.match(tarifs, /data-tarifs-channel="mobile"/);
  assert.match(tarifs, /data-tarifs-channel="international"/);
  assert.match(tarifs, /Lemon Squeezy/);
  assert.match(tarifs, /Bientôt disponible/);
  assert.match(tarifs, /data-tarifs-pay="lemon-squeezy"[\s\S]{0,80}disabled/);
});

test("/pro : plus de vente à la clé ni de Deck à importer", () => {
  const pro = readCode("src/routes/pro.tsx");
  assert.doesNotMatch(pro, /Activer ma clé/);
  assert.doesNotMatch(pro, /OPT-XXXX/);
  assert.doesNotMatch(pro, /Importer mon Deck/);
  assert.doesNotMatch(pro, /J’ai déjà reçu une clé/);
  assert.doesNotMatch(pro, /à vie/);
  assert.doesNotMatch(pro, /Accès confirmé/);
});

test("/pro : bandeau d'abonnement daté + action de gestion", () => {
  const pro = readCode("src/routes/pro.tsx");
  assert.match(pro, /data-subscription-hero/);
  assert.match(pro, /data-subscription-detail/);
  assert.match(pro, /formatSubscriptionEnd\(/);
  assert.match(pro, /data-subscription-manage/);
  assert.match(pro, /Gérer mon abonnement/);
  // L'échéance vient de la licence, pas d'une constante décorative.
  assert.match(pro, /licenceExpiresAt/);
  // Le garde-fou du tunnel : /pro doit toujours pointer vers /tarifs.
  assert.match(pro, /to="\/tarifs"/);
});

test("/profil : email du compte affiché et déconnexion explicite", () => {
  const profil = readCode("src/routes/profil.tsx");
  assert.match(profil, /data-account-email/);
  assert.match(profil, /cloudAuth\.session\?\.user\?\.email/);
  assert.match(profil, /variant="danger"/);
  assert.match(profil, /resetContentSession\(\)/);
  assert.match(profil, /signOutCloud\(\)/);
});

test("le vocabulaire du modèle mort ne revient pas dans la copie produit", () => {
  for (const path of [
    "src/routes/tarifs.tsx",
    "src/routes/pro.tsx",
    "src/routes/achats.tsx",
    "src/routes/cas.$caseId.tsx",
    "src/routes/demarche.$id.tsx",
    "src/routes/parcours.$deckId.tsx",
  ]) {
    const source = readCode(path);
    assert.doesNotMatch(source, /Achat unique/, path);
    assert.doesNotMatch(source, /accès à vie/i, path);
    assert.doesNotMatch(source, /dès 3 000 Ar/, path);
  }
});

test("l'accueil ne promet pas « à vie » et n'annonce que la durée réelle (i18n ×4)", () => {
  for (const locale of ["fr", "en", "es", "pt"]) {
    const catalog = read(`src/i18n/messages/${locale}.ts`);
    const line = catalog.split("\n").find((row) => row.includes("comparePremiumLine")) ?? "";
    assert.ok(line.length > 0, locale);
    // Le modèle mort ne revient pas…
    assert.doesNotMatch(line, /à vie|for life|para siempre|para sempre/i, locale);
    // …et s'il annonce une durée, c'est bien celle de l'offre ouverte (3 mois,
    // ABO-11) : aucune autre durée ne doit apparaître.
    const otherDurations = line.match(/\d+\s*(?:mois|months?|meses|mês)/gi) ?? [];
    for (const duration of otherDurations) {
      assert.match(duration, /^3\s*(?:mois|months?|meses|mês)$/i, `${locale} : ${duration}`);
    }
    // Ce qui est promis reste le contenu Premium.
    assert.match(line, /Premium/, locale);
  }
});
