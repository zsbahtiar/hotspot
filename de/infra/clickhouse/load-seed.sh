#!/bin/bash
set -euo pipefail

SEED_DIR="/seed"

if ! ls "$SEED_DIR"/*.native.gz >/dev/null 2>&1; then
  echo "[seed] no seed files found in $SEED_DIR, skipping."
  exit 0
fi

echo "[seed] loading production seed data into hotspot.* ..."
for f in "$SEED_DIR"/*.native.gz; do
  t="$(basename "$f" .native.gz)"
  echo "[seed] -> hotspot.$t"
  gunzip -c "$f" | clickhouse-client --host 127.0.0.1 --query "INSERT INTO hotspot.$t FORMAT Native"
done

echo "[seed] done. Row counts:"
clickhouse-client --host 127.0.0.1 --query \
  "SELECT table, sum(rows) AS rows FROM system.parts WHERE database='hotspot' AND active GROUP BY table ORDER BY rows DESC"
