import type { Context } from "hono";

// SQLite timestamp format used throughout: "YYYY-MM-DD HH:MM:SS.SSS".

export function toSqlTs(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.` +
    `${p(d.getUTCMilliseconds(), 3)}`
  );
}

// Converts the stored SQL timestamp ("YYYY-MM-DD HH:MM:SS.SSS", UTC) to RFC3339
// ("YYYY-MM-DDTHH:MM:SSZ") so JS Date parses it as UTC (not local), matching the
// Go API. Passes through anything that already looks ISO.
export function toRFC3339(sqlTs: string): string {
  if (!sqlTs) return sqlTs;
  if (sqlTs.includes("T")) return sqlTs;
  return sqlTs.slice(0, 19).replace(" ", "T") + "Z";
}

export function sqlDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

// Parses an RFC3339 string; returns null if absent/invalid (mirrors Go's silent skip).
export function parseRFC3339(v: string | undefined): Date | null {
  if (!v) return null;
  const t = Date.parse(v);
  if (Number.isNaN(t)) return null;
  return new Date(t);
}

// Offset in minutes encoded in an RFC3339 string ("+07:00" -> 420). 0 for Z/none.
export function rfc3339OffsetMinutes(v: string | undefined): number {
  if (!v) return 0;
  const m = v.match(/([+-])(\d{2}):?(\d{2})$/);
  if (!m) return 0; // trailing Z or no zone
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

export function intParam(c: Context, name: string): number {
  const raw = c.req.query(name);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

export function boundedInt(
  c: Context,
  name: string,
  def: number,
  min: number,
  max: number,
): number {
  const raw = c.req.query(name);
  if (!raw) return def;
  const n = parseInt(raw, 10);
  if (Number.isFinite(n) && n >= min && n <= max) return n;
  return def;
}

export function strParam(c: Context, name: string): string {
  return c.req.query(name) ?? "";
}

// Opaque cursor: base64("<acquired_at raw>|<id>"). Internally consistent with the
// stored acquired_at string; row-value comparison (acquired_at,id) < (?,?) drives paging.
export function encodeCursor(acquiredAt: string, id: string): string {
  return btoa(`${acquiredAt}|${id}`);
}

export function decodeCursor(
  cursor: string,
): { acquiredAt: string; id: string } | null {
  if (!cursor) return null;
  try {
    const decoded = atob(cursor);
    const idx = decoded.indexOf("|");
    if (idx < 0) return null;
    return { acquiredAt: decoded.slice(0, idx), id: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}
