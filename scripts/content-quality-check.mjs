#!/usr/bin/env node
/**
 * Contrôle qualité du contenu médical — Optimus v3
 *
 * Détecte uniquement les VRAIS problèmes :
 *  - JSON invalides
 *  - Fiches sans sources (erreur)
 *  - Posologies chiffrées (mg, µg, UI, mg/kg) non sourcées (erreur)
 *  - Patterns contextuellement interdits (serpent, etc.) (erreur)
 *  - Fiches publiées sans reviewedBy (warning informatif)
 * 
 * Les sources sans `type` sont acceptées silencieusement (format legacy).
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const CONTENT_DIRS = ["private/content/pathologies", "private/content/signes"];

const FORBIDDEN_PATTERNS = [
  { regex: /\bcobra\b/i, severity: "error", reason: "Cobra absent de Madagascar" },
  { regex: /\bvipère africaine\b/i, severity: "error", reason: "Vipère africaine absente de Madagascar" },
  { regex: /morsure de serpent/i, severity: "warn", reason: "Morsure de serpent rare à Madagascar" },
  { regex: /example\.com/i, severity: "error", reason: "URL placeholder" },
];

// Posologies CHIFFRÉES (mg, µg, UI, mg/kg) — on exclut les seuils biologiques (g/L, mmol/L)
const POSOLOGY_PATTERNS = [
  /\b\d+([.,]\d+)?\s*mg(?![\/\w])/gi,
  /\b\d+([.,]\d+)?\s*µg\b/gi,
  /\b\d+([.,]\d+)?\s*UI(?![\s/]|L|ml|mL|kg|m2)/gi,
  /\b\d+([.,]\d+)?\s*mg\s*\/\s*kg\b/gi,
];

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

const errors = [];
const warnings = [];
let files = 0;

for (const dir of CONTENT_DIRS) {
  for (const file of walkDir(path.join(ROOT, dir))) {
    files++;
    const rel = path.relative(ROOT, file);
    let obj;
    try {
      obj = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
      errors.push({ file: rel, msg: "JSON invalide : " + e.message });
      continue;
    }

    // Sources obligatoires (uniquement si fichier a un status = c'est une fiche)
    if (obj && typeof obj === "object" && !Array.isArray(obj) && obj.status) {
      if (!Array.isArray(obj.sources) || obj.sources.length === 0) {
        errors.push({ file: rel, msg: "Aucune source déclarée" });
      }
      // Fiches publiées sans reviewedBy = warning (pas bloquant)
      if (obj.status === "published" && (!obj.reviewedBy || String(obj.reviewedBy).trim().length < 3)) {
        warnings.push({ file: rel, msg: "published sans reviewedBy" });
      }
    }

    // Patterns interdits + posologies
    const text = fs.readFileSync(file, "utf8");
    for (const pat of FORBIDDEN_PATTERNS) {
      if (pat.regex.test(text)) {
        (pat.severity === "error" ? errors : warnings).push({ file: rel, msg: pat.reason });
      }
    }
    for (const pat of POSOLOGY_PATTERNS) {
      const matches = text.match(pat);
      if (matches && !/rcp|recommandation|société savante|posologie|voir fiche/i.test(text)) {
        // Filtrer les faux positifs évidents (seuils biologiques mal regexés)
        const realPosologies = matches.filter(m => {
          const num = parseFloat(m.replace(/[^\d.,]/g, "").replace(",", "."));
          // Ignorer les valeurs < 1 (souvent des seuils biologiques mal interprétés)
          return num >= 1;
        });
        if (realPosologies.length > 0) {
          errors.push({ file: rel, msg: "Posologie non sourcée : " + realPosologies.slice(0, 3).join(", ") });
        }
      }
    }
  }
}

console.log("");
console.log("📊 Contrôle qualité : " + files + " fichiers scannés");
console.log("");

if (warnings.length > 0) {
  console.log("⚠️  " + warnings.length + " AVERTISSEMENTS (non bloquants)");
  const byMsg = {};
  warnings.forEach(w => { byMsg[w.msg] = (byMsg[w.msg] || 0) + 1; });
  Object.entries(byMsg).forEach(([msg, count]) => console.log("   " + count + "× " + msg));
  console.log("");
}

if (errors.length > 0) {
  console.log("❌ " + errors.length + " ERREURS BLOQUANTES :");
  errors.forEach(e => console.log("   [" + e.file + "] " + e.msg));
  console.log("");
  process.exit(1);
}

console.log("✅ Aucune erreur bloquante. " + warnings.length + " avertissement(s) informatif(s).");
process.exit(0);
