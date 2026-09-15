import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const storeSource = readFileSync(new URL("../src/state/store.ts", import.meta.url), "utf8");
const migrationSource = readFileSync(
  new URL("../src/state/persist-migrations.ts", import.meta.url),
  "utf8",
);
const coverStorageSource = readFileSync(
  new URL("../src/lib/profile-cover-storage.ts", import.meta.url),
  "utf8",
);
const profileSource = readFileSync(new URL("../src/routes/profil.tsx", import.meta.url), "utf8");

test("Optimus local state stays on the historical key but uses explicit versioned migrations", () => {
  assert.match(storeSource, /name:\s*["']optimus-v2["']/);
  assert.match(storeSource, /version:\s*OPTIMUS_PERSIST_VERSION/);
  assert.match(storeSource, /migrate:\s*\(persistedState,\s*version\)/);
  assert.match(storeSource, /migrateOptimusPersistedState\(persistedState,\s*version\)/);
  assert.match(migrationSource, /OPTIMUS_PERSIST_VERSION\s*=\s*2/);
});

test("custom profile covers use IndexedDB blobs and migrate legacy base64", () => {
  assert.match(coverStorageSource, /indexedDB\.open/);
  assert.match(coverStorageSource, /objectStore\(STORE_NAME\)\.put\(blob/);
  assert.match(coverStorageSource, /MAX_PROFILE_COVER_BYTES\s*=\s*2\s*\*\s*1024\s*\*\s*1024/);
  assert.match(profileSource, /canvas\.toBlob/);
  assert.match(profileSource, /saveProfileCover\(profile\.optimusId,\s*blob\)/);
  assert.match(profileSource, /dataUrlToImageBlob\(profile\.coverDataUrl\)/);
  assert.match(profileSource, /update\(\{\s*coverDataUrl:\s*null\s*\}\)/);
});

test("new custom covers never fall back to persistent base64 when IndexedDB fails", () => {
  assert.doesNotMatch(profileSource, /canvas\.toDataURL/);
  assert.match(profileSource, /update\(\{\s*cover:\s*"custom",\s*coverDataUrl:\s*null\s*\}\)/);
  assert.match(profileSource, /cet appareil n’a pas pu l’enregistrer durablement/);
});

test("IndexedDB transactions register completion handlers before awaiting requests", () => {
  assert.match(
    coverStorageSource,
    /const transaction = db\.transaction\(STORE_NAME, "readonly"\);\s*const completed = waitForTransaction\(transaction\);\s*const request =/s,
  );
  assert.match(coverStorageSource, /await completed;/);
});
