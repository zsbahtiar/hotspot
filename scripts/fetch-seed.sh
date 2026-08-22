#!/usr/bin/env bash
set -euo pipefail

# Unduh data seed ClickHouse dari GitHub Release ke de/infra/clickhouse/seed/.
# Jalankan sekali sebelum `docker compose up` agar dashboard langsung berisi data.

REPO="zsbahtiar/hotspot"
TAG="seed-v1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SEED_DIR="$ROOT/de/infra/clickhouse/seed"
BASE="https://github.com/$REPO/releases/download/$TAG"

FILES=(
  backfill_hotspot backfill_state
  dim_confidence dim_location dim_period dim_satellite dim_weather_condition
  fact_hotspot fact_weather geo_coordinate_cache
  staging_hotspot staging_weather
)

mkdir -p "$SEED_DIR"
echo "Mengunduh ${#FILES[@]} berkas seed dari $BASE ..."
for f in "${FILES[@]}"; do
  out="$SEED_DIR/$f.native.gz"
  if [ -s "$out" ]; then
    echo "  [skip] $f.native.gz sudah ada"
    continue
  fi
  echo "  [get]  $f.native.gz"
  curl -fL --retry 3 --retry-delay 2 -o "$out" "$BASE/$f.native.gz"
done
echo "Selesai. Seed tersimpan di $SEED_DIR"
echo "Lanjutkan dengan: docker compose up -d --build"
