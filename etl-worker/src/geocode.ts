// Offline reverse geocoding against the village boundaries stored in D1.
//
// The DuckDB spatial geocoder was ported into D1 as `geo_boundary` (village
// hierarchy + simplified GeoJSON polygon) and `geo_rtree` (an R*Tree bounding-box
// index). For a point we ask the R*Tree for candidate villages whose bbox
// contains it, then run an exact point-in-polygon test in JS. No BMKG, no cache.
import { ulid } from "./ulid";
import { log } from "./log";

export interface LocationRow {
  id: string;
  province_code: string;
  province_name: string;
  city_code: string;
  city_name: string;
  district_code: string;
  district_name: string;
  subdistrict_code: string;
  subdistrict_name: string;
}

interface BoundaryRow {
  province_code: string;
  province_name: string;
  regency_code: string;
  regency_name: string;
  district_code: string;
  district_name: string;
  village_code: string;
  village_name: string;
  geom: string;
}

function coordKey(lat: string, lng: string): string {
  return `${lat},${lng}`;
}

// Ray-casting point-in-polygon for a single ring of [lng, lat] pairs.
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Handles GeoJSON Polygon ([ring...]) and MultiPolygon ([[ring...]...]), with holes.
function pointInGeometry(lng: number, lat: number, geom: string): boolean {
  let g: { type: string; coordinates: number[][][] | number[][][][] };
  try {
    g = JSON.parse(geom);
  } catch {
    return false;
  }
  const polys = (g.type === "MultiPolygon"
    ? (g.coordinates as number[][][][])
    : [g.coordinates as number[][][]]);
  for (const poly of polys) {
    if (!poly.length || !pointInRing(lng, lat, poly[0])) continue; // outer ring
    let inHole = false;
    for (let h = 1; h < poly.length; h++) {
      if (pointInRing(lng, lat, poly[h])) { inHole = true; break; }
    }
    if (!inHole) return true;
  }
  return false;
}

export class Geocoder {
  private subdistrictToId = new Map<string, string>();
  newLocations: LocationRow[] = [];

  constructor(private db: D1Database) {}

  // Preload existing dim_location so resolved villages reuse their location_id.
  async preloadLocations(): Promise<void> {
    const res = await this.db
      .prepare("SELECT subdistrict_code, id FROM dim_location WHERE subdistrict_code != ''")
      .all<{ subdistrict_code: string; id: string }>();
    for (const r of res.results ?? []) this.subdistrictToId.set(r.subdistrict_code, r.id);
  }

  private async lookup(lat: number, lng: number): Promise<BoundaryRow | null> {
    const res = await this.db
      .prepare(
        `SELECT b.province_code, b.province_name, b.regency_code, b.regency_name,
                b.district_code, b.district_name, b.village_code, b.village_name, b.geom
         FROM geo_rtree r JOIN geo_boundary b ON b.id = r.id
         WHERE r.min_lng <= ? AND r.max_lng >= ? AND r.min_lat <= ? AND r.max_lat >= ?`,
      )
      .bind(lng, lng, lat, lat)
      .all<BoundaryRow>();
    for (const b of res.results ?? []) {
      if (pointInGeometry(lng, lat, b.geom)) return b;
    }
    return null;
  }

  private locationId(b: BoundaryRow): string {
    let id = this.subdistrictToId.get(b.village_code);
    if (!id) {
      id = ulid();
      this.subdistrictToId.set(b.village_code, id);
      this.newLocations.push({
        id,
        province_code: b.province_code,
        province_name: b.province_name,
        city_code: b.regency_code,
        city_name: b.regency_name,
        district_code: b.district_code,
        district_name: b.district_name,
        subdistrict_code: b.village_code,
        subdistrict_name: b.village_name,
      });
    }
    return id;
  }

  // Resolves each unique coordinate to a location_id. Coordinates that fall
  // outside every Indonesian village (ocean/border) are simply absent.
  async resolve(coords: { lat: string; lng: string }[]): Promise<Map<string, string>> {
    const uniq = new Map<string, { lat: string; lng: string }>();
    for (const c of coords) uniq.set(coordKey(c.lat, c.lng), c);
    const list = [...uniq.values()];

    const out = new Map<string, string>();
    const CONCURRENCY = 12; // parallel rtree lookups per batch
    for (let i = 0; i < list.length; i += CONCURRENCY) {
      const batch = list.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (c) => {
          const lat = parseFloat(c.lat);
          const lng = parseFloat(c.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          try {
            const b = await this.lookup(lat, lng);
            return b ? { c, b } : null;
          } catch (e) {
            log.warn("geocode lookup failed", { coord: coordKey(c.lat, c.lng), error: String(e) });
            return null;
          }
        }),
      );
      // locationId mutates shared maps, so assign sequentially after the batch.
      for (const r of results) {
        if (r) out.set(coordKey(r.c.lat, r.c.lng), this.locationId(r.b));
      }
    }
    return out;
  }
}

export { coordKey };
