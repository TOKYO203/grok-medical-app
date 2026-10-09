#!/bin/sh
# Relance le serveur de développement de l'app (preview sur 0.0.0.0:8080).
# Idempotent : ne démarre que si le port ne répond pas déjà.
set -eu

# Se placer dans le dossier du script (fonctionne dans /workspace comme ailleurs).
cd "$(dirname "$0")"

if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi

LOG_DIR="$PWD/.devx/logs"
mkdir -p "$LOG_DIR"

npm run dev > "$LOG_DIR/dev.log" 2>&1 &

for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40; do
  if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
    exit 0
  fi
  sleep 0.5
done

exit 0
