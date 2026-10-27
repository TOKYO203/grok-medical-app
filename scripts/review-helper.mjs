#!/usr/bin/env node
import fs from "fs";
import path from "path";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/review-helper.mjs <chemin-fiche.json>");
  process.exit(1);
}

const text = fs.readFileSync(file, "utf8");

console.log("\n📋 POINTS À VÉRIFIER : " + file + "\n");

// Sources
try {
  const obj = JSON.parse(text);
  if (Array.isArray(obj.sources)) {
    console.log("📚 SOURCES (" + obj.sources.length + ") :");
    obj.sources.forEach((s, i) => {
      console.log(`   ${i+1}. [${s.type || "?"}] ${s.ref || "(sans ref)"}`);
      console.log(`      URL : ${s.url || "(absente)"}`);
    });
    console.log("");
  }
} catch {}

// Posologies
const posologies = text.match(/\d+([.,]\d+)?\s*(mg|µg|UI|mg\/kg)\b(?![\/\w])/gi) || [];
if (posologies.length) {
  console.log("💊 POSOLOGIES (" + posologies.length + ") :");
  [...new Set(posologies)].forEach(p => console.log("   - " + p));
  console.log("   → Vérifier source RCP/HAS pour chaque");
  console.log("");
}

// Seuils biologiques
const seuils = text.match(/\d+([.,]\d+)?\s*(mmol\/L|g\/L|g\/dL|UI\/L|mg\/L|µmol\/L|%)/gi) || [];
if (seuils.length) {
  console.log("🧪 SEUILS BIOLOGIQUES (" + seuils.length + ") :");
  [...new Set(seuils)].forEach(s => console.log("   - " + s));
  console.log("   → Vérifier valeur exacte");
  console.log("");
}

// Scores
const scores = text.match(/\b(CHADS\w*|GRACE|Wells|CURB-?\d*|GCS|NIHSS|Child-?\w*|MELD|APACHE|SOFA|qSOFA|CURB-65|PSI)\b/gi) || [];
if (scores.length) {
  console.log("📊 SCORES (" + scores.length + ") :");
  [...new Set(scores)].forEach(s => console.log("   - " + s));
  console.log("   → Vérifier formule + interprétation");
  console.log("");
}

console.log("━".repeat(60) + "\n");
