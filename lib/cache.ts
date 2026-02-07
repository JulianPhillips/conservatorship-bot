type CacheEntry = { value: string; createdAt: number };

const PLAN_CACHE = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60_000; // 5 minutes

export function getCachedPlan(key: string): string | null {
  const entry = PLAN_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    PLAN_CACHE.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedPlan(key: string, value: string) {
  PLAN_CACHE.set(key, { value, createdAt: Date.now() });
}
