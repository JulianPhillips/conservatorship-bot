const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10;

type Entry = { count: number; windowStart: number };
const buckets = new Map<string, Entry>();

export function checkRateLimit(ip: string | null | undefined): boolean {
  const key = ip || "unknown";
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= MAX_REQUESTS) return false;

  entry.count += 1;
  return true;
}
