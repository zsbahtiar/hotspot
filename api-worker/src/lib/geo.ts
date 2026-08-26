// Island grouping and timezone helpers, ported 1:1 from the Go service.

export function extractIslandFromProvinceCode(provinceCode: string): string {
  if (provinceCode.length < 2) return "LAINNYA";
  const prefix = provinceCode.slice(0, 2);
  switch (prefix) {
    case "11": case "12": case "13": case "14": case "15":
    case "16": case "17": case "18": case "19": case "21":
      return "SUMATERA";
    case "31": case "32": case "33": case "34": case "35": case "36":
      return "JAWA";
    case "51":
      return "BALI";
    case "52": case "53":
      return "NUSA TENGGARA";
    case "61": case "62": case "63": case "64": case "65":
      return "KALIMANTAN";
    case "71": case "72": case "73": case "74": case "75": case "76":
      return "SULAWESI";
    case "81": case "82":
      return "MALUKU";
    case "91": case "92": case "93": case "94": case "95": case "96":
      return "PAPUA";
    default:
      return "LAINNYA";
  }
}

// Maps an RFC3339 zone offset (from start_date) to an IANA name, like the Go handler.
export function offsetToTimezone(offsetMinutes: number): string {
  const hours = Math.trunc(offsetMinutes / 60);
  switch (hours) {
    case 7: return "Asia/Jakarta";
    case 8: return "Asia/Makassar";
    case 9: return "Asia/Jayapura";
    case 0: return "UTC";
    default: return "UTC";
  }
}

// SQLite has no tz database, so we translate the handful of IANA zones this app
// uses into a fixed hour offset for use with datetime(ts, '+N hours').
export function tzOffsetModifier(tz: string): string {
  return `${tzOffsetHours(tz) >= 0 ? "+" : ""}${tzOffsetHours(tz)} hours`;
}

// Fixed UTC offset (hours) for the zones this app uses. Data is stored in UTC;
// callers shift it to the client's zone for "today"/bucketing.
export function tzOffsetHours(tz: string): number {
  switch (tz) {
    case "Asia/Jakarta": return 7;
    case "Asia/Makassar": return 8;
    case "Asia/Jayapura": return 9;
    default: return 0;
  }
}
