/* Contrat : les variables VITE_SUPABASE_* collees avec des guillemets dans les
   secrets GitHub ne doivent pas produire un client Supabase invalide.
   (Prod, 2026-11-10 : secrets colles avec guillemets, login affichait
   de façon déterministe « cloud non configuré ».) */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const supabase = read("../src/lib/supabase.ts");

test("readEnv retire les guillemets englobants des variables VITE", () => {
  // Deux replace en chaine : tete puis queue, caractere guillemet inclus
  // (doubles, simples et backticks) dans chaque classe de caracteres.
  const head = supabase.match(/replace\(\/\^\[[^\]]+\]\+\//);
  const tail = supabase.match(/replace\(\/\[[^\]]+\]\+\$\//);
  assert.ok(head, "replace de tete manquant");
  assert.ok(tail, "replace de queue manquant");
  assert.match(head[0], /\[/);
});
