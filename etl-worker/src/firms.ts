// NASA FIRMS area CSV client. Fetches recent detections for the Indonesia bbox
// across the configured sources (MODIS + VIIRS). Mirrors NASAFIRMSClient.

import { log } from "./log";

export interface HotspotRaw {
  latitude: string;
  longitude: string;
  acq_date: string; // YYYY-MM-DD
  acq_time: string; // HHMM (zero-padded)
  satellite: string;
  instrument: string; // MODIS | VIIRS
  confidence: string; // numeric (MODIS) or l/n/h (VIIRS)
  version: string;
  frp: number;
  daynight: string;
  brightness: number;
  bright_t31: number;
  scan: number;
  track: number;
  bright_ti4: number;
  bright_ti5: number;
}

function num(v: string | undefined): number {
  if (v === undefined || v === "") return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length <= 1) return [];
  const header = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    const row: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) row[header[j]] = (cells[j] ?? "").trim();
    rows.push(row);
  }
  return rows;
}

export async function fetchFirms(
  env: { NASA_FIRMS_BASE_URL: string; NASA_FIRMS_API_KEY: string; INDONESIA_BBOX: string },
  source: string,
  dayRange = 1,
): Promise<HotspotRaw[]> {
  if (!env.NASA_FIRMS_API_KEY) throw new Error("NASA_FIRMS_API_KEY not configured");
  const url = `${env.NASA_FIRMS_BASE_URL}/api/area/csv/${env.NASA_FIRMS_API_KEY}/${source}/${env.INDONESIA_BBOX}/${dayRange}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FIRMS ${source} HTTP ${res.status}`);
  const text = (await res.text()).trim();
  if (text.includes("Invalid") || text.includes("Error")) {
    throw new Error(`FIRMS ${source} error: ${text.slice(0, 120)}`);
  }
  // Normalise instrument + satellite from the SOURCE (not the raw CSV column),
  // matching the production ETL: NOAA21->N21, NOAA20->N20, SNPP->N, MODIS keeps
  // its Terra/Aqua satellite value.
  const instrument = source.startsWith("MODIS") ? "MODIS" : "VIIRS";
  const normSat = (raw: string): string =>
    source.includes("NOAA21") ? "N21"
      : source.includes("NOAA20") ? "N20"
        : source.includes("SNPP") ? "N"
          : (raw || "");
  const rows = parseCsv(text);
  return rows
    .filter((r) => r.latitude && r.longitude && r.acq_date && r.acq_time)
    .map((r) => {
      return {
        latitude: r.latitude,
        longitude: r.longitude,
        acq_date: r.acq_date,
        acq_time: String(r.acq_time).padStart(4, "0"),
        satellite: normSat(r.satellite ?? ""),
        instrument,
        confidence: r.confidence ?? "",
        version: r.version ?? "",
        frp: num(r.frp),
        daynight: r.daynight ?? "",
        brightness: num(r.brightness),
        bright_t31: num(r.bright_t31),
        scan: num(r.scan),
        track: num(r.track),
        bright_ti4: num(r.bright_ti4),
        bright_ti5: num(r.bright_ti5),
      };
    });
}

export async function fetchAllFirms(env: {
  NASA_FIRMS_BASE_URL: string;
  NASA_FIRMS_API_KEY: string;
  INDONESIA_BBOX: string;
  FIRMS_SOURCES: string;
}): Promise<HotspotRaw[]> {
  const sources = env.FIRMS_SOURCES.split(",").map((s) => s.trim()).filter(Boolean);
  const all: HotspotRaw[] = [];
  for (const source of sources) {
    try {
      const rows = await fetchFirms(env, source, 1);
      all.push(...rows);
    } catch (e) {
      log.warn("FIRMS fetch failed", { source, error: String(e) });
    }
  }
  return all;
}
