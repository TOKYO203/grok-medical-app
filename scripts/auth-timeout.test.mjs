/* Contrat : les appels d'authentification Supabase sont encadrés par un
   timeout. Sans lui, une connexion mobile qui stalle laisse le bouton bloqué
   sur « Connexion… » sans aucun message (constaté en prod, 2026-11-10). */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const authScreen = read("../src/components/AuthScreen.tsx");

test("signIn et signUp passent par le timeout d'authentification", () => {
  assert.match(authScreen, /AUTH_TIMEOUT_MS = 15_000/);
  assert.match(authScreen, /function withTimeout/);
  // Les deux deux-points d'entrée (connexion ET inscription) sont encadrés :
  // un seul suffirait à reproduire le spinner infini sur l'autre.
  const wrapped = authScreen.match(/withTimeout\(/g) ?? [];
  assert.ok(wrapped.length >= 3, "withTimeout doit encadrer signIn ET signUp");
  assert.match(authScreen, /withTimeout\(\s*client\.auth\.signInWithPassword/);
  assert.match(authScreen, /withTimeout\(\s*client\.auth\.signUp/);
});

test("le dépassement de délai produit un message réseau clair", () => {
  // AuthTimeoutError hérite d'un message « fetch failed » : friendlyAuthError
  // le route vers « Impossible de joindre le service… », jamais un silence.
  assert.match(authScreen, /class AuthTimeoutError/);
  assert.match(authScreen, /fetch failed/);
});
