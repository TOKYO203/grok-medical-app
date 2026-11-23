#!/usr/bin/env bash
# Correctifs audit médical IA 2026-11-22 (2e passe) — decks.json
# Généré suite à l'audit indépendant ; détails : docs/MEDICAL-AUDIT-LOG.md
# Usage : bash scripts/medical-audit-2026-11-22-patch.sh
set -euo pipefail
F=src/content/data/decks.json

patch_q() { # deck_id qid json_file
  jq --slurpfile q "$3" 'map(if .id=="'$1'" then .questions |= map(if .id=="'$2'" then $q[0] else . end) else . end)' "$F" > "$F.tmp" && mv "$F.tmp" "$F"
}

# 1) tetanos-l4-6 : les BDZ potentialisent l'inhibition GABAergique
jq --arg e "Les benzodiazépines potentialisent l'action du GABA sur son récepteur (renforcement de l'inhibition neuronale, absente du tétanos qui bloque la libération de glycine) et contrôlent ainsi les contractures : diazépam ou clonazépam, titrés selon la fréquence des spasmes, restent la pierre angulaire de la sédation du tétanos."   'map(if .id=="infectio-tetanos-l4" then .questions |= map(if .id=="tetanos-l4-6" then .explanation=$e else . end) else . end)' "$F" > "$F.tmp" && mv "$F.tmp" "$F"

# 2) vih-l3-10 : stade 4 OMS clinique ; 200 CD4 = critère de sida (CDC)
jq --arg e "Sous 200 CD4, le risque d'infections opportunistes majeures explose : pneumocystose, toxoplasmose cérébrale, cryptococcose, candidose œsophagienne. C'est le seuil de sida (critère CDC) ; le stade 4 de la classification OMS, lui, se définit sur des événements cliniques et non sur un chiffre de CD4."   'map(if .id=="infectio-vih-l3" then .questions |= map(if .id=="vih-l3-10" then .explanation=$e else . end) else . end)' "$F" > "$F.tmp" && mv "$F.tmp" "$F"

# 3) avc-l2-7 : scanner = examen de première ligne en hyperaiguë (cohérent avec avc-l4-1)
cat > /tmp/avc-l2-7.json <<'EOF'
{
  "id": "avc-l2-7",
  "prompt": "À la phase hyperaiguë d'un AVC, quelle imagerie est privilégiée et pourquoi ?",
  "choices": [
    "L'IRM cérébrale, plus sensible pour l'ischémie précoce mais rarement disponible en urgence immédiate",
    "Le scanner cérébral : rapide et disponible, il élimine en priorité une hémorragie avant toute thrombolyse",
    "L'IRM cardiaque en première intention",
    "L'échographie transcrânienne"
  ],
  "correct": 1,
  "explanation": "En hyperaiguë, le scanner sans injection est l'examen de première ligne : rapide et largement disponible, il visualise le sang frais et conditionne la décision de thrombolyse (une hémorragie visible l'interdit ; voir aussi la question avc-l4-1 de ce deck). L'IRM (séquence de diffusion) est plus sensible pour l'ischémie très précoce, mais reste de deuxième intention à cette phase ; la séquence FLAIR aide aux AVC du réveil dans des protocoles spécialisés. Le scanner reste équivalent à l'IRM pour détecter l'hémorragie.",
  "sources": [
    { "title": "HAS", "citation": "Guide du parcours de santé — AVC de l'adulte, octobre 2025, section 4.3.1, p. 32" }
  ],
  "difficulty": "base",
  "competency": "diagnosis"
}
EOF
patch_q neuro-avc-l2 avc-l2-7 /tmp/avc-l2-7.json
rm -f /tmp/avc-l2-7.json

# Vérifications
jq -e . "$F" > /dev/null
grep -q "potentialisent l'action du GABA" "$F"
grep -q "élimine en priorité une hémorragie" "$F"
grep -q "critère CDC" "$F"
echo "OK : 3 correctifs appliqués. Relancer ensuite : npm run release:check ; puis régénérer les signatures Premium."
