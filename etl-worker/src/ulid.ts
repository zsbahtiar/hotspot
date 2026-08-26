// Minimal ULID generator (Crockford base32, 48-bit time + 80-bit randomness).
// Used to mint new dimension ids, matching the Python ETL's use of ULIDs.
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeTime(now: number, len: number): string {
  let out = "";
  for (let i = len - 1; i >= 0; i--) {
    const mod = now % 32;
    out = ENCODING[mod] + out;
    now = (now - mod) / 32;
  }
  return out;
}

function encodeRandom(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += ENCODING[bytes[i] % 32];
  return out;
}

export function ulid(time: number = Date.now()): string {
  return encodeTime(time, 10) + encodeRandom(16);
}
