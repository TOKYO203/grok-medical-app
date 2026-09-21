#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'; BOLD=$'\033[1m'; NC=$'\033[0m'

log()  { echo "${BLUE}▸${NC} $*"; }
ok()   { echo "${GREEN}✔${NC} $*"; }
warn() { echo "${YELLOW}⚠${NC} $*"; }
err()  { echo "${RED}✘${NC} $*" >&2; }
die()  { err "$*"; exit 1; }

PROJECT="grok-medical-app"
LIVE_URL="https://grok-medical-app.vercel.app"
VAR_NAME="ADMIN_PASSWORD"
ENVS=("production" "preview" "development")

log "Vérification des prérequis…"
command -v vercel >/dev/null 2>&1 || die "Vercel CLI absent. Installe-le : npm i -g vercel"
command -v curl   >/dev/null 2>&1 || die "curl absent. Installe-le : pkg install curl"
vercel whoami >/dev/null 2>&1 || die "Non connecté à Vercel. Lance : vercel login"
ok "Prérequis OK ($(vercel whoami 2>/dev/null))"

echo
log "Saisie du nouveau mot de passe admin."
read -r -s -p "  Mot de passe (vide = généré) : " ADMIN_PWD
echo

if [[ -z "${ADMIN_PWD:-}" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    ADMIN_PWD="Optimus-$(openssl rand -hex 8)"
  else
    ADMIN_PWD="Optimus-$(date +%s | sha256sum | head -c 16)"
  fi
  warn "Mot de passe généré : ${BOLD}${ADMIN_PWD}${NC}"
fi

[[ ${#ADMIN_PWD} -lt 8 ]] && die "Mot de passe trop court (min 8 caractères)."

read -r -p "  Confirmer le déploiement sur Vercel ? [y/N] " CONFIRM
[[ "${CONFIRM,,}" != "y" ]] && { warn "Annulé."; exit 0; }

echo
log "Suppression de l'ancienne variable ${VAR_NAME}…"
for env in "${ENVS[@]}"; do
  vercel env rm "$VAR_NAME" "$env" --yes >/dev/null 2>&1 && ok "  - supprimée dans $env" \
    || warn "  - absente dans $env (ignoré)"
done

echo
log "Création de ${VAR_NAME} (type Secret)…"
for env in "${ENVS[@]}"; do
  printf "%s" "$ADMIN_PWD" | vercel env add "$VAR_NAME" "$env" >/dev/null \
    && ok "  - ajoutée dans $env" \
    || die "Échec d'ajout dans $env"
done

echo
log "Redéploiement de production…"
if git -C ~/grok-medical-app rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C ~/grok-medical-app commit --allow-empty -m "chore: trigger redeploy for admin password" >/dev/null
  git -C ~/grok-medical-app push origin main >/dev/null && ok "Push effectué."
else
  warn "Pas de repo git, redéploie manuellement via l'UI Vercel."
fi

echo
log "Attente de propagation (max 180s)…"
for i in $(seq 1 60); do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$LIVE_URL/api/admin-verify" \
    -H "Content-Type: application/json" -d '{"adminKey":"__probe__"}' || echo "000")
  if [[ "$HTTP" =~ ^[245][0-9]{2}$ ]]; then
    ok "API répond (HTTP $HTTP) après $((i*3))s."
    break
  fi
  printf "."
  sleep 3
  [[ $i -eq 60 ]] && { echo; die "Timeout : l'API ne répond toujours pas."; }
done

echo
log "Test 1 : mauvais mot de passe…"
R1=$(curl -s -X POST "$LIVE_URL/api/admin-verify" \
  -H "Content-Type: application/json" -d '{"adminKey":"wrong-password-test"}')
echo "  → $R1"
echo "$R1" | grep -q '"valid":false' && ok "Test 1 OK" || err "Test 1 ÉCHEC (fail open !)"

echo
log "Test 2 : bon mot de passe…"
R2=$(curl -s -X POST "$LIVE_URL/api/admin-verify" \
  -H "Content-Type: application/json" -d "{\"adminKey\":\"$ADMIN_PWD\"}")
echo "  → $R2"
echo "$R2" | grep -q '"valid":true' && ok "Test 2 OK — LOGIN ADMIN FONCTIONNEL" \
  || err "Test 2 ÉCHEC — vérifie les logs Vercel"

echo
echo "${BOLD}════════════════════════════════════════════════${NC}"
if echo "$R2" | grep -q '"valid":true'; then
  ok "${BOLD}SUCCÈS${NC} — ${VAR_NAME} opérationnel."
  echo "   Mot de passe : ${BOLD}${ADMIN_PWD}${NC}"
  echo "   Type         : Secret"
  echo "   Envs         : ${ENVS[*]}"
else
  err "${BOLD}ÉCHEC${NC} — logs : vercel logs $LIVE_URL --follow"
  exit 1
fi
echo "${BOLD}════════════════════════════════════════════════${NC}"
