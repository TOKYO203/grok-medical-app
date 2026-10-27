#!/usr/bin/env node
/**
 * Audit de risque du contenu existant.
 * Classe les fiches par score de risque (0-10) pour prioriser la relecture humaine.
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const CONTENT_DIRS = ["private/content/pathologies", "private/content/signes"];

// Patterns qui augmentent le risque
const RISK_PATTERNS = [
  { regex: /\b\d+([.,]\d+)?\s*(mg|µg|UI|mg\/kg)\b/gi, points: 3, reason: "Posologie chiffrée" },
  { regex: /\bscore\b/i, points: 2, reason: "Score clinique (calcul à vérifier)" },
  { regex: /\b(CHADS|GRACE|Wells|CURB|GCS|NIHSS|Child|MELD|APACHE|SOFA)\b/gi, points: 3, reason: "Score nommé" },
  { regex: /\b\d+([.,]\d+)?\s*(mmol\/L|g\/L|g\/dL|UI\/L|mg\/L|µmol\/L)\b/gi, points: 2, reason: "Seuil biologique" },
  { regex: /\b(sclérose en plaques|mucoviscidose|leishmaniose|fièvre jaune|borréliose|maladie de Lyme)\b/gi, points: 3, reason: "Pathologie rare à Mada" },
  { regex: /\[À COMPLÉTER|TODO|TODO:|XXX\b/gi, points: 2, reason: "TODO/placeholder" },
  { regex: /\b\d+([.,]\d+)?\s*%\b/gi, points: 1, reason: "Pourcentage (seuil à vérifier)" },
];

// Scores de risque par pathologie (heuristique)
const HIGH_RISK_PATHOLOGIES = new Set([
  "paludisme", "tuberculose", "meningites-purulentes", "tetanos", "vih",
  "hta-essentielle", "diabete-type-2", "insuffisance-cardiaque",
  "embolie-pulmonaire", "syndrome-coronarien-aigu", "avc",
  "preeclampsie", "hellp", "etat-de-choc",
]);

function walkDir(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkDir(full));
    else if (entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

const results = [];
for (const dir of CONTENT_DIRS) {
  for (const file of walkDir(path.join(ROOT, dir))) {
    const rel = path.relative(ROOT, file);
    const text = fs.readFileSync(file, "utf8");
    let score = 0;
    const reasons = [];

    // Bonus si pathologie à haute criticité
    const fileName = path.basename(file, ".json");
    if (HIGH_RISK_PATHOLOGIES.has(fileName)) {
      score += 4;
      reasons.push("pathologie critique");
    }

    // Patterns de risque
    for (const pat of RISK_PATTERNS) {
      const matches = text.match(pat.regex);
      if (matches) {
        score += Math.min(pat.points, 5);
        reasons.push(pat.reason + " (" + matches.length + ")");
      }
    }

    // Fiche sans relecteur
    try {
      const obj = JSON.parse(text);
      if (obj.status === "published" && !obj.reviewedBy) {
        score += 2;
        reasons.push("publiée sans relecteur");
      }
    } catch { /* déjà détecté par content:check */ }

    results.push({ file: rel, score, reasons });
  }
}

results.sort((a, b) => b.score - a.score);

console.log("\n🎯 AUDIT DE RISQUE — Priorisation relecture\n");
console.log("Top 30 fiches à relire en priorité :\n");
results.slice(0, 30).forEach((r, i) => {
  console.log(`${(i + 1).toString().padStart(2)}. [Score ${r.score}] ${r.file}`);
  console.log(`    → ${r.reasons.join(", ")}`);
});
console.log(`\nTotal : ${results.length} fiches.`);
console.log(`Priorité haute (score ≥ 8) : ${results.filter(r => r.score >= 8).length} fiches`);
console.log(`Priorité moyenne (score 5-7) : ${results.filter(r => r.score >= 5 && r.score < 8).length} fiches`);
console.log(`Priorité basse (score < 5) : ${results.filter(r => r.score < 5).length} fiches\n`);
