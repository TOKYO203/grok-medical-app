successfully downloaded text file (SHA: 817b557a3cd4cdadd85f7882512e741ca00bba2a)import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Garde-fou Session 1 — business model freemium/premium (MISSION-INTERNATIONAL).
// Protège A01 (prix multi-devises), A03 (essai 7 jours), A05 (teaser 30 s)
// et A07 (badges progressifs) contre les régressions silencieuses.
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("A01 — les prix proviennent de la source unique src/content/pricing.ts", () => {
  const pricing = read("../src/content/pricing.ts");
  for (const code of ["MGA", "USD", "EUR"]) {
    assert.ok(pricing.includes(`"${code}"`), `pricing.ts doit définir la devise ${code}`);
  }
  assert.ok(pricing.includes("detectPreferredCurrency"), "la devise doit être détectée automatiquement");
  assert.ok(pricing.includes("INDICATIVE_RATES"), "les conversions USD/EUR doivent être indicatives et constantes");

  const tarifs = read("../src/routes/tarifs.tsx");
  assert.ok(
    tarifs.includes("@/content/pricing"),
    "tarifs.tsx doit importer la source unique des prix",
  );
  assert.ok(
    !tarifs.includes("const DECK_PRICE") && !tarifs.includes("const SPECIALTY_PRICE"),
    "plus de prix dupliqué en dur dans tarifs.tsx",
  );
});

test("A03 — l'essai 7 jours reste un état local distinct des droits serveur", () => {
  const trial = read("../src/lib/premium-trial.ts");
  assert.ok(trial.includes("TRIAL_DAYS = 7"), "l'essai doit durer 7 jours");

  const store = read("../src/state/store.ts");
  assert.ok(store.includes("premiumTrial"), "le store doit persister l'état d'essai");
  assert.ok(store.includes("startPremiumTrial"), "le store doit exposer startPremiumTrial");
  assert.ok(
    !store.includes("OPTIMUS_TRIAL"),
    "l'essai ne doit JAMAIS être enregistré comme un entitlement serveur",
  );
  assert.ok(
    store.includes("if (s.premiumTrial) return {};"),
    "un seul essai par profil : jamais réinitialisé une fois démarré",
  );

  for (const route of ["../src/routes/cas.$caseId.tsx", "../src/routes/demarche.$id.tsx"]) {
    const content = read(route);
    assert.ok(content.includes("isTrialActive"), `${route} doit respecter l'essai actif`);
  }

  const pro = read("../src/routes/pro.tsx");
  assert.ok(pro.includes("startPremiumTrial"), "la page /pro doit permettre de démarrer l'essai");
  assert.ok(pro.includes("Essai Premium"), "la page /pro doit afficher l'état de l'essai");
});

test("A05 — le teaser Premium de 30 secondes est intégré à la page Pro", () => {
  const teaser = read("../src/components/premium-teaser.tsx");
  assert.ok(teaser.includes("TOTAL_MS"), "la durée totale du teaser doit être calculée");
  assert.ok(
    teaser.includes("prefers-reduced-motion"),
    "le teaser doit respecter prefers-reduced-motion",
  );
  const pro = read("../src/routes/pro.tsx");
  assert.ok(pro.includes("PremiumTeaser"), "pro.tsx doit afficher le teaser Premium");
});

test("A07 — la progression vers les badges est visible sur le profil", () => {
  const engine = read("../src/lib/gamification/badge-progress.ts");
  assert.ok(engine.includes("Encore"), "le moteur doit produire les messages « Encore … »");
  assert.ok(
    engine.includes("countAnswered"),
    "les seuils doivent réutiliser les signaux de unlockBadges",
  );
  // Session 11 (vue détail) : le profil expose la progression de chaque badge
  // via badgeGoals/badgeGoalById — le prochain objectif reste badgeGoalList[0].
  const profil = read("../src/routes/profil.tsx");
  assert.ok(
    profil.includes("badgeGoals"),
    "profil.tsx doit valoriser les objectifs calculés",
  );
  assert.ok(
    profil.includes("badgeGoalById"),
    "profil.tsx doit exposer la progression de chaque badge",
  );
});

test("Session 1 — les décisions sont consignées dans docs/DECISIONS.md", () => {
  const decisions = read("../docs/DECISIONS.md");
  for (const id of ["A01", "A03", "A05", "A07"]) {
    assert.ok(decisions.includes(id), `la décision ${id} doit être journalisée`);
  }
  assert.ok(decisions.includes("Session 1"), "la session 1 doit figurer comme terminée");
});

test("B20 — canal email institutionnel pour l'offre École", () => {
  const contact = read("../src/routes/contact.tsx");
  assert.ok(
    contact.includes('id: "school"'),
    "le formulaire de contact doit offrir le sujet « École ou établissement »",
  );
  assert.ok(
    contact.includes("Devis École & Établissement"),
    "l'objet du mail institutionnel doit être prérempli",
  );
  const types = read("../src/core/types.ts");
  assert.ok(
    types.includes('| "school"'),
    "ContactDraft doit étendre son union kind à school",
  );
});
