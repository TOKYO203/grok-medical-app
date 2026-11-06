#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

IDX="${1:-src/content/data/programmes/_index.json}"

if [[ ! -f "$IDX" ]]; then
  echo "❌ Fichier introuvable: $IDX"; exit 1
fi

echo "=== 1. Structure du manifeste ==="
jq -r 'type' "$IDX"

ENTRIES_PATH=$(jq -r '
  if type=="array" then "."
  elif has("items") then ".items"
  elif has("entries") then ".entries"
  elif has("fiches") then ".fiches"
  else "."
  end' "$IDX")

COUNT=$(jq "$ENTRIES_PATH | length" "$IDX")
echo "Entrées détectées: $COUNT (path: $ENTRIES_PATH)"

echo
echo "=== 2. Clés de la 1ère entrée ==="
jq -r "$ENTRIES_PATH[0] | keys[]" "$IDX" | tr '\n' ' '; echo

echo
echo "=== 3. Ordinals dupliqués ==="
DUPS=$(jq -r "$ENTRIES_PATH | group_by(.ordinal) | map(select(length>1)) | .[] | \"ordinal \(.[0].ordinal) → \([.[].n] | join(\", \"))\"" "$IDX")
if [[ -z "$DUPS" ]]; then echo "✅ Aucun doublon"; else echo "$DUPS" | sed 's/^/⚠️  /'; fi

echo
echo "=== 4. Ordinals hors plage 1..240 ==="
OUT=$(jq -r "$ENTRIES_PATH[] | select(.ordinal < 1 or .ordinal > 240) | \"ordinal \(.ordinal) (n=\(.n))\"" "$IDX")
if [[ -z "$OUT" ]]; then echo "✅ Tous dans 1..240"; else echo "$OUT" | sed 's/^/⚠️  /'; fi

echo
echo "=== 5. Cohérence n + 175 = ordinal (plage 216-240) ==="
BAD=$(jq -r "$ENTRIES_PATH[] | select(.ordinal >= 216 and .ordinal <= 240) | select((.n + 175) != .ordinal) | \"n=\(.n) ordinal=\(.ordinal) attendu=\(.n + 175)\"" "$IDX")
if [[ -z "$BAD" ]]; then echo "✅ Cohérent sur 216-240"; else echo "$BAD" | sed 's/^/❌ /'; fi

echo
echo "=== 6. Gaps dans 216-235 (n43-60 théoriques) ==="
PRESENT=$(jq -r "$ENTRIES_PATH[] | select(.ordinal >= 216 and .ordinal <= 235) | .ordinal" "$IDX" | sort -n)
FOUND=0
for o in $(seq 216 235); do
  if ! echo "$PRESENT" | grep -qx "$o"; then
    n=$((o - 175))
    echo "  MANQUANT ordinal=$o (n=$n)"
    FOUND=1
  fi
done
[[ $FOUND -eq 0 ]] && echo "  ✅ Plage 216-235 complète"

echo
echo "=== 7. Total ==="
echo "Entrées: $COUNT | Max ordinal: $(jq -r "$ENTRIES_PATH | map(.ordinal) | max" "$IDX")"
