// Offline reverse geocoding against the village boundaries stored in D1.
//
// The DuckDB spatial geocoder was ported into D1 as `geo_boundary` (village
// hierarchy + simplified GeoJSON polygon) and `geo_rtree` (an R*Tree bounding-box
// index). For a point we ask the R*Tree for candidate villages whose bbox
// contains it, then run an exact point-in-polygon test in JS. No BMKG, no cache.
import { ulid } from "./ulid";

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
  id: number;
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

  // In-memory R*Tree bbox index, bucketed into a coarse grid so per-point
  // candidate lookup costs zero D1 queries (see preloadBoundaries).
  private static CELL = 0.1; // grid cell size in degrees
  private grid = new Map<string, number[]>(); // "cx:cy" -> boundary ids
  private bboxById = new Map<number, [number, number, number, number]>(); // id -> [minLng,maxLng,minLat,maxLat]

  constructor(private db: D1Database) {}

  // Preload existing dim_location so resolved villages reuse their location_id.
  async preloadLocations(): Promise<void> {
    const res = await this.db
      .prepare("SELECT subdistrict_code, id FROM dim_location WHERE subdistrict_code != ''")
      .all<{ subdistrict_code: string; id: string }>();
    for (const r of res.results ?? []) this.subdistrictToId.set(r.subdistrict_code, r.id);
  }

  private static cellKey(cx: number, cy: number): string {
    return `${cx}:${cy}`;
  }

  // Load the whole R*Tree bbox index (id + bbox only, no geom) into memory once
  // and bucket it into a coarse grid. This replaces the old one-D1-query-per-point
  // pattern, which blew the Worker's per-invocation subrequest limit (1000) when an
  // ingest carried thousands of coordinates. Paged so a big result never trips D1's
  // response-size cap. Call once before resolve().
  async preloadBoundaries(): Promise<void> {
    const CHUNK = 20000;
    const c = Geocoder.CELL;
    for (let offset = 0; ; offset += CHUNK) {
      const res = await this.db
        .prepare(
          "SELECT id, min_lng, max_lng, min_lat, max_lat FROM geo_rtree ORDER BY id LIMIT ? OFFSET ?",
        )
        .bind(CHUNK, offset)
        .all<{
          id: number;
          min_lng: number;
          max_lng: number;
          min_lat: number;
          max_lat: number;
        }>();
      const rows = res.results ?? [];
      for (const r of rows) {
        this.bboxById.set(r.id, [r.min_lng, r.max_lng, r.min_lat, r.max_lat]);
        const x0 = Math.floor(r.min_lng / c),
          x1 = Math.floor(r.max_lng / c);
        const y0 = Math.floor(r.min_lat / c),
          y1 = Math.floor(r.max_lat / c);
        for (let x = x0; x <= x1; x++) {
          for (let y = y0; y <= y1; y++) {
            const k = Geocoder.cellKey(x, y);
            const arr = this.grid.get(k);
            if (arr) arr.push(r.id);
            else this.grid.set(k, [r.id]);
          }
        }
      }
      if (rows.length < CHUNK) break;
    }
  }

  // Candidate boundary ids whose bbox contains the point (pure in-memory, no D1).
  private candidates(lng: number, lat: number): number[] {
    const c = Geocoder.CELL;
    const ids = this.grid.get(
      Geocoder.cellKey(Math.floor(lng / c), Math.floor(lat / c)),
    );
    if (!ids) return [];
    const out: number[] = [];
    for (const id of ids) {
      const b = this.bboxById.get(id);
      if (b && b[0] <= lng && b[1] >= lng && b[2] <= lat && b[3] >= lat)
        out.push(id);
    }
    return out;
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

    // 1. Candidate boundary ids per point, entirely in memory (no D1).
    const points: { key: string; lat: number; lng: number; ids: number[] }[] = [];
    const needed = new Set<number>();
    for (const c of list) {
      const lat = parseFloat(c.lat);
      const lng = parseFloat(c.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const ids = this.candidates(lng, lat);
      if (ids.length === 0) continue; // ocean / outside every village
      points.push({ key: coordKey(c.lat, c.lng), lat, lng, ids });
      for (const id of ids) needed.add(id);
    }
    if (points.length === 0) return new Map();

    // 2. Fetch geom + hierarchy for just the candidate villages, batched under
    //    D1's 100-bound-parameter limit. A handful of queries, not thousands.
    const boundaries = new Map<number, BoundaryRow>();
    const idList = [...needed];
    const BATCH = 90;
    for (let i = 0; i < idList.length; i += BATCH) {
      const chunk = idList.slice(i, i + BATCH);
      const ph = chunk.map(() => "?").join(",");
      const res = await this.db
        .prepare(
          `SELECT id, province_code, province_name, regency_code, regency_name,
                  district_code, district_name, village_code, village_name, geom
           FROM geo_boundary WHERE id IN (${ph})`,
        )
        .bind(...chunk)
        .all<BoundaryRow>();
      for (const b of res.results ?? []) boundaries.set(b.id, b);
    }

    // 3. Exact point-in-polygon; first matching candidate wins.
    const out = new Map<string, string>();
    for (const p of points) {
      for (const id of p.ids) {
        const b = boundaries.get(id);
        if (b && pointInGeometry(p.lng, p.lat, b.geom)) {
          out.set(p.key, this.locationId(b));
          break;
        }
      }
    }
    return out;
  }
}

export { coordKey };
