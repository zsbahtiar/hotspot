// KV-backed cache that mirrors the Go/Redis caching semantics.
//
// The Go service caches JSON blobs in Redis and tracks every key it writes in a
// Redis set ("api_cache_keys") so the ETL can purge them all when new data lands.
// KV has no sets, so we keep an index list under CACHE_INDEX_KEY. The ETL worker
// bumps a version prefix (see bumpVersion) which is the cheap, race-free way to
// invalidate everything at once on Cloudflare.

const CACHE_INDEX_KEY = "__api_cache_keys__";
const VERSION_KEY = "__cache_version__";

export class Cache {
  constructor(private kv: KVNamespace) {}

  private async version(): Promise<string> {
    return (await this.kv.get(VERSION_KEY)) ?? "v1";
  }

  private prefixed(key: string, version: string): string {
    return `${version}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const version = await this.version();
    const raw = await this.kv.get(this.prefixed(key, version), "json");
    return (raw as T) ?? null;
  }

  // Fire-and-forget style write (await it inside ctx.waitUntil at the call site).
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const version = await this.version();
    await this.kv.put(this.prefixed(key, version), JSON.stringify(value), {
      expirationTtl: Math.max(ttlSeconds, 60),
    });
  }

  // Invalidate everything by moving to a new version namespace. Old keys expire on TTL.
  async bumpVersion(): Promise<string> {
    const current = await this.version();
    const n = parseInt(current.replace(/^v/, ""), 10) || 1;
    const next = `v${n + 1}`;
    await this.kv.put(VERSION_KEY, next);
    return next;
  }
}

export const TTL = {
  // Values match the Go service (seconds).
  hotspots: 60 * 60, // 1h
  geojson: 2 * 60 * 60, // 2h
  summary: 2 * 60 * 60, // 2h
  filterOptions: 24 * 60 * 60, // 24h
  periods: 24 * 60 * 60, // 24h
  locations: 24 * 60 * 60, // 24h
} as const;

export { CACHE_INDEX_KEY };
