import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [
  serverOrders,
  purchaseFlow,
  purchasesPage,
  adminPage,
  learningSync,
  verificationMigration,
  stateMachineMigration,
  issueKey,
] = await Promise.all([
  read("../src/lib/purchase-orders.ts"),
  read("../src/components/premium-purchase-flow.tsx"),
  read("../src/routes/achats.tsx"),
  read("../src/routes/admin-achats.tsx"),
  read("../src/lib/optimus-sync-model.ts"),
  read("../migrations/0010_purchase_verification.sql"),
  read("../migrations/0011_purchase_state_machine.sql"),
  read("./issue-activation-key.mjs"),
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

test("Mobile Money destination is server-configured and checkout fails closed when absent", () => {
  for (const variable of [
    "MOBILE_MONEY_PROVIDER",
    "MOBILE_MONEY_NUMBER",
    "MOBILE_MONEY_ACCOUNT_NAME",
    "MOBILE_MONEY_INSTRUCTIONS",
  ]) {
    assert.match(serverOrders, new RegExp(variable));
  }
  assert.match(serverOrders, /configured:\s*Boolean\(provider && destination\)/);
  assert.match(purchaseFlow, /getPremiumPaymentInstructions/);
  assert.match(purchaseFlow, /!paymentInstructions\?\.configured/);
  assert.doesNotMatch(purchaseFlow, /03\d{8}|032\d{7}|033\d{7}|034\d{7}|038\d{7}/);
});

test("payment replay protection binds a unique operator reference and proof digest", () => {
  assert.match(verificationMigration, /purchase_orders_payment_reference_unique_idx/);
  assert.match(verificationMigration, /purchase_orders_proof_digest_unique_idx/);
  assert.match(purchaseFlow, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(serverOrders, /normalizePaymentReference/);
  assert.match(serverOrders, /proofDigest/);
  assert.match(serverOrders, /paymentReference/);
  assert.match(serverOrders, /déjà liée à une autre commande/);
});

test("database enforces the canonical commercial state machine", () => {
  assert.match(stateMachineMigration, /guard_purchase_order_status_transition/);
  assert.match(stateMachineMigration, /created' AND NEW\.status = 'instructions_requested/);
  assert.match(stateMachineMigration, /verification_pending' AND NEW\.status = 'payment_verified/);
  assert.match(stateMachineMigration, /payment_verified' AND NEW\.status = 'delivered/);
  assert.match(stateMachineMigration, /delivered' AND NEW\.status = 'refunded/);
  assert.match(stateMachineMigration, /invalid purchase status transition/);
});

test("clients cannot self-authorize payment verification or delivery", () => {
  assert.match(serverOrders, /clientStatusSchema/);
  assert.match(serverOrders, /verification_pending/);
  assert.match(serverOrders, /PURCHASE_ADMIN_USER_IDS/);
  assert.match(serverOrders, /requirePurchaseAdmin/);
  assert.match(serverOrders, /payment_verified/);
  assert.doesNotMatch(purchaseFlow, /status:\s*["']payment_verified["']/);
  assert.doesNotMatch(purchaseFlow, /status:\s*["']delivered["']/);
});

test("admin back office stays server-authorized and separates verify from deliver", () => {
  assert.match(adminPage, /listPremiumPurchaseOrdersForAdmin/);
  assert.match(adminPage, /reviewPremiumPurchaseOrder/);
  assert.match(adminPage, /payment_verified/);
  assert.match(adminPage, /delivered/);
  assert.match(adminPage, /Accès opérateur requis/);
  assert.match(serverOrders, /requirePurchaseAdmin\(context\.userId\)/);
});

test("refund revokes activation keys explicitly linked to the purchase", () => {
  assert.match(verificationMigration, /purchase_reference text REFERENCES purchase_orders/);
  assert.match(stateMachineMigration, /revoke_purchase_licenses_on_refund/);
  assert.match(stateMachineMigration, /purchase_reference = NEW\.reference/);
  assert.match(stateMachineMigration, /revoked_at = COALESCE\(revoked_at, now\(\)\)/);
  assert.match(serverOrders, /update activation_keys/);
  assert.match(issueKey, /--purchase-ref/);
  assert.match(issueKey, /payment_verified/);
});

test("device private material and raw proof files stay outside commerce and learning cloud stores", () => {
  assert.match(purchaseFlow, /publicKey: deviceIdentity\.publicKey/);
  assert.match(purchaseFlow, /fileSha256/);
  assert.doesNotMatch(serverOrders, /privateKey|private_key/);
  assert.doesNotMatch(serverOrders, /contentBase64|arrayBuffer\(|File\b/);
  assert.doesNotMatch(learningSync, /purchaseSchema|purchases:/);
});

test("purchases screen refreshes canonical server orders and labels local data as cache", () => {
  assert.match(purchasesPage, /listPremiumPurchaseOrders/);
  assert.match(purchasesPage, /replacePurchaseCache/);
  assert.match(purchasesPage, /Mode hors ligne/);
  assert.match(purchasesPage, /registre commercial|serveur/);
  assert.match(purchasesPage, /payment_verified/);
});
