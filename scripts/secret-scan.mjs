#!/usr/bin/env node
/**
 * Scan local des secrets par gitleaks (`.gitleaks.toml` à la racine).
 *
 * Deux usages :
 *   node scripts/secret-scan.mjs            → index git (ce qui va être commité)
 *   node scripts/secret-scan.mjs --history  → tout l'historique git
 *
 * Le mode par défaut lit l'INDEX, jamais le répertoire : `.env.local` contient
 * de vrais secrets par nature et n'est pas suivi par git — scanner l'arbre de
 * travail ferait donc hurler l'outil sur le fichier que `.gitignore` protège
 * déjà, et un scanner qui crie pour rien finit ignoré.
 *
 * Pourquoi un wrapper : gitleaks n'est pas une dépendance npm (binaire Go), il
 * ne doit donc pas casser `npm install`. Le script échoue AVANT de scanner si
 * le binaire manque, avec la commande d'installation, plutôt que de rendre un
 * faux « tout est propre ».
 *
 * Le même scan tourne en CI (job `secret-scan` de `.github/workflows/security.yml`),
 * limité au delta de la PR pour rester actionnable.
 */
import { spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const history = args.includes("--history");

function findGitleaks() {
  // Résolution manuelle : sous Termux le binaire vit souvent hors du PATH.
  const candidates = [
    "gitleaks",
    `${homedir()}/gitleaks`,
    `${homedir()}/bin/gitleaks`,
    `${process.cwd()}/node_modules/.bin/gitleaks`,
  ];
  for (const candidate of candidates) {
    if (candidate === "gitleaks") {
      const which = spawnSync("command", ["-v", "gitleaks"], { shell: true, encoding: "utf8" });
      if (which.status === 0 && which.stdout.trim()) return "gitleaks";
      continue;
    }
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const binary = findGitleaks();
if (!binary) {
  console.error(
    [
      "gitleaks introuvable.",
      "",
      "Installation (une fois) :",
      "  curl -sSfL https://github.com/gitleaks/gitleaks/releases/download/v8.28.0/gitleaks_8.28.0_linux_arm64.tar.gz | tar -xz gitleaks",
      "  mv gitleaks ~/gitleaks && chmod +x ~/gitleaks",
      "",
      "Le scan tourne aussi en CI sur chaque PR (job « secret-scan »).",
    ].join("\n"),
  );
  process.exit(2);
}

// On passe TOUJOURS par stdin (`gitleaks stdin`) plutôt que par les modes
// `git`/`dir` : sous Termux (Android), les modes qui relancent `git` en
// sous-processus meurent sur un appel système interdit (SIGSYS), alors que le
// mode stdin fonctionne. Un seul chemin ⇒ le même verdict sur le téléphone, sur
// un poste de dev et en CI.
const diff = history
  ? spawnSync("git", ["log", "-p", "--all", "--no-color", "--format=commit %H"], {
      encoding: "utf8",
      maxBuffer: 512 * 1024 * 1024,
    })
  : spawnSync("git", ["diff", "--cached", "--no-color", "-U3"], {
      encoding: "utf8",
      maxBuffer: 512 * 1024 * 1024,
    });

if (diff.error || (diff.status !== 0 && !diff.stdout)) {
  console.error(`✘ lecture de git impossible : ${diff.error?.message ?? `code ${diff.status}`}`);
  process.exit(2);
}
if (!diff.stdout.trim()) {
  console.log(`✔ rien à scanner (${history ? "historique vide" : "index vide"})`);
  process.exit(0);
}

// Le diff passe par un FICHIER temporaire et une redirection shell, pas par le
// `input` de spawnSync : quand Node alimente le stdin de gitleaks, le lecteur
// découpe le flux autrement que depuis un fichier et invente des faux positifs
// (mesuré : 7 « sourcegraph-access-token » fantômes sur 19 Mo, 0 en
// redirection). Le fichier temporaire rend le verdict reproductible.
const tmpFile = join(tmpdir(), `optimus-secret-scan-${process.pid}.diff`);
writeFileSync(tmpFile, diff.stdout, { mode: 0o600 });

const quote = (value) => `'${value.replace(/'/g, `'\\''`)}'`;
const command = [
  quote(binary),
  "stdin",
  "--config",
  ".gitleaks.toml",
  "--redact",
  "--verbose",
  "--no-banner",
  "<",
  quote(tmpFile),
].join(" ");

console.log(`▸ gitleaks ${history ? "historique complet" : "index (staged)"} — ${binary}`);
const result = spawnSync("sh", ["-c", command], { stdio: ["ignore", "inherit", "inherit"] });
try {
  rmSync(tmpFile);
} catch {
  /* le fichier temporaire est sans importance s'il reste : il est ignoré par git */
}

if (result.status === 0) {
  console.log("✔ aucun secret détecté");
} else if (result.status === 1) {
  console.error("✘ secrets détectés — révoquer d'abord, puis retirer du code (jamais l'inverse)");
  if (history) {
    console.error(
      [
        "",
        "Rappel : le mot de passe admin de `src/routes/admin-debug.tsx` (commit a87d8d4,",
        "septembre 2026) est TOUJOURS dans l'historique. Il a été révoqué le 2026-10-17,",
        "donc il est inerte — mais il y reste lisible. Tant que la purge n'est pas faite,",
        "ce mode restera rouge : c'est volontaire.",
        "",
        "Purge (réécrit l'historique) : docs/SECURITY-AUDIT.md § « Purger un secret de l'historique ».",
      ].join("\n"),
    );
  }
}
process.exit(result.status ?? 2);
