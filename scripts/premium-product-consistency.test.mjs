import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

/**
 * Garde-fou de la migration « 15 decks/spécialité » (commit 432e196) :
 * le produit pack spécialité est `{CODE}_PACK_15` côté commande, et les contrôles
 * d'accès (cas cliniques + démarches) doivent vérifier EXACTEMENT ce même produit.
 * Historiquement ils testaient `_PACK_10` (jamais émis), donc un acheteur d'un pack
 * ne débloquait jamais les cas ni les démarches.
 */
test("specialty pack product is identical for purchase and access checks", async () => {
  const [order, index, caseRoute, demarcheRoute] = await Promise.all([
    read("src/content/purchase-order.ts"),
    read("src/lib/library/content-index.ts"),
    read("src/routes/cas.$caseId.tsx"),
    read("src/routes/demarche.$id.tsx"),
  ]);

  // Producteur : la commande « spécialité complète » émet `{CODE}_PACK_15`.
  assert.match(order, /`\$\{specialty\.code\}_PACK_15`/, "orderProduct must emit _PACK_15");
  assert.doesNotMatch(order, /_PACK_10/, "purchase-order must not emit the retired _PACK_10");

  // Source unique de vérité : helper `specialtyPackProduct` aligné sur la commande.
  assert.match(index, /export function specialtyPackProduct/, "missing shared helper");
  assert.match(index, /`\$\{specialtyCode\(specialty\)\}_PACK_15`/, "helper must map to _PACK_15");
  assert.match(
    index,
    /hasEntitlement\(specialtyPackProduct\(clinical\.specialty\), entitlements\)/,
    "caseAccessible must use the shared helper",
  );

  // Consommateurs : le détail cas et le détail démarche utilisent le helper, plus de produit mort.
  for (const [name, source] of [
    ["cas.$caseId.tsx", caseRoute],
    ["demarche.$id.tsx", demarcheRoute],
  ]) {
    assert.match(source, /specialtyPackProduct\(/, `${name}: use the shared specialty pack helper`);
    assert.doesNotMatch(source, /_PACK_10/, `${name}: must not check the retired _PACK_10 product`);
  }
});
