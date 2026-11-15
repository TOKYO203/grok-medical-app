import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * Régressions de l'audit sécurité 2026-11-15 (grok-medical-app).
 *
 * F2 — les endpoints de licence ne doivent plus dériver le sujet du rate
 *      limit de valeurs contrôlées par l'appelant (optimusId, deviceId,
 *      licenseId d'un reçu) : repli constant sinon contournement du quota.
 * F3 — l'exemption admin de /admin-login doit être exacte, pas un préfixe.
 */

test("F2: /api/licenses/activate n'utilise plus de sujet contrôlé par l'appelant", () => {
  const src = readFileSync(new URL("../server/api/licenses/activate.ts", import.meta.url), "utf8");
  assert.ok(!src.includes('clientIp || `${optimusId}'), "repli optimusId:deviceId encore présent");
  assert.ok(src.includes('clientIp ?? "no-client-ip"'), "repli constant absent");
});

test("F2: /api/licenses/status n'utilise plus le reçu comme sujet de rate limit", () => {
  const src = readFileSync(new URL("../server/api/licenses/status.ts", import.meta.url), "utf8");
  assert.ok(!src.includes('receipt.payload.licenseId ||'), "repli sur le reçu encore présent");
  assert.ok(src.includes('getClientIp(event) ?? "no-client-ip"'), "repli constant absent");
});

test("F3: l'exemption /admin-login est exacte (pas un préfixe large)", () => {
  const src = readFileSync(new URL("../server/middleware/admin-guard.ts", import.meta.url), "utf8");
  assert.ok(src.includes('pathname === "/admin-login" || pathname.startsWith("/admin-login/")'), "exemption exacte absente");
});
