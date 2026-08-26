#!/usr/bin/env bash
# Resumable bulk import of seed/full/*.sql into D1 via wrangler d1 execute.
# - runs 00_reset.sql exactly once (guarded by a marker)
# - imports dims -> dim_location -> geo_coordinate_cache -> facts
# - records each finished file in .imported so re-runs skip it
# - retries each file a few times
#
# Usage: scripts/import_d1.sh [--local|--remote]   (default --remote)
set -uo pipefail
cd "$(dirname "$0")/.."

TARGET="${1:---remote}"
DIR="seed/full"
DONE="$DIR/.imported"
RESET_MARK="$DIR/.reset_done"
touch "$DONE"

run() {
  local file="$1"
  if grep -qxF "$file" "$DONE" 2>/dev/null; then
    echo "skip (done): $file"; return 0
  fi
  # Rewrite to INSERT OR IGNORE so a resumed run cannot fail on duplicate PKs.
  local tmp="/tmp/d1imp_$(basename "$file")"
  sed 's/^INSERT INTO/INSERT OR IGNORE INTO/' "$file" > "$tmp"
  for attempt in 1 2 3 4 5; do
    echo ">> import $file (attempt $attempt)"
    # Success is wrangler's own exit code, not a grep of its output.
    if CI=1 pnpm exec wrangler d1 execute hotspot "$TARGET" --file="$tmp" > /tmp/d1imp.out 2>&1; then
      echo "$file" >> "$DONE"; rm -f "$tmp"; echo "   OK: $file"; return 0
    fi
    if grep -qiE "daily row write limit|exceeded" /tmp/d1imp.out; then
      echo "!! D1 daily write limit hit. Enable Workers Paid or resume after 00:00 UTC."; exit 2
    fi
    echo "   retry $file after error"; sleep 4
  done
  echo "!! FAILED after retries: $file"; exit 1
}

# 1. reset once
if [ ! -f "$RESET_MARK" ]; then
  echo ">> reset (00_reset.sql)"
  CI=1 pnpm exec wrangler d1 execute hotspot "$TARGET" --file="$DIR/00_reset.sql" && touch "$RESET_MARK"
fi

# 2. small dims
for f in dim_confidence dim_period dim_satellite dim_weather_condition; do
  [ -f "$DIR/$f.sql" ] && run "$DIR/$f.sql"
done
# 3. dim_location chunks, 4. geo cache chunks, 5. facts (sorted)
for f in $(ls "$DIR"/dim_location-*.sql 2>/dev/null | sort); do run "$f"; done
for f in $(ls "$DIR"/geo_coordinate_cache-*.sql 2>/dev/null | sort); do run "$f"; done
for f in $(ls "$DIR"/fact_hotspot-*.sql 2>/dev/null | sort); do run "$f"; done
for f in $(ls "$DIR"/fact_weather-*.sql 2>/dev/null | sort); do run "$f"; done

echo "ALL DONE. Imported $(wc -l < "$DONE") files."
