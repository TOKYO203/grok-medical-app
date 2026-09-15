import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [serverOrders, purchaseFlow, purchasesPage, learningSync] = await Promise.all([
  read("../src/lib/purchase-orders.ts"),
  read("../src/components/premium-purchase-flow.tsx"),
  read("../src/routes/achats.tsx"),
  read("../src/lib/optimus-sync-model.ts"),
]);

test("purchase ownership comes only from verified auth context", () => {
  assert.match(serverOrders, /middleware\(\[authMiddleware\]\)/);
  assert.match(serverOrders, /context\.userId/);
  assert.doesNotMatch(serverOrders, /data\.userId|data\.user_id/);
  assert.match(serverOrders, /where user_id = \$1/);
});

test("commercial reference, product and amount are server generated", () => {
  assert.match(serverOrders, /randomBytes\(4\)/);
  assert.match(serverOrders, /orderProduct\(order\)/);
  assert.match(serverOrders, /orderAmount\(order\)/);
  assert.match(serverOrders, /clientRequestId/);
  assert.doesNotMatch(purchaseFlow, /function makeReference/);
  assert.match(purchaseFlow, /createPremiumPurchaseOrder/);
});

test("clients cannot self-authorize delivery", () => {
  assert.match(serverOrders, /clientStatusSchema/);
  assert.match(serverOrders, /verification_pending/);
  assert.match(serverOrders, /PURCHASE_ADMIN_USER_IDS/);
  assert.match(serverOrders, /requirePurchaseAdmin/);
  assert.doesNotMatch(purchaseFlow, /status:\s*["']delivered["']/);
});

test("device private material stays outside commerce and learning cloud stores", () => {
  assert.match(purchaseFlow, /publicKey: deviceIdentity\.publicKey/);
  assert.doesNotMatch(serverOrders, /privateKey|private_key/);
  assert.doesNotMatch(learningSync, /purchaseSchema|purchases:/);
});

test("purchases screen refreshes canonical server orders and labels local data as cache", () => {
  assert.match(purchasesPage, /listPremiumPurchaseOrders/);
  assert.match(purchasesPage, /replacePurchaseCache/);
  assert.match(purchasesPage, /Mode hors ligne/);
  assert.match(purchasesPage, /registre serveur|serveur/);
});
