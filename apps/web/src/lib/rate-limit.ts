/**
 * In-memory sliding window rate limiter for Next.js serverless functions.
 *
 * Uses a module-level Map so state persists within a warm serverless instance.
 * Resets on cold start — acceptable for auth endpoint protection against
 * sustained brute-force attacks from the same source.
 *
 * For cross-instance rate limiting, upgrade to a Redis-backed implementation.
 */

const store = new Map<string, number[]>();

const CLEANUP_THRESHOLD = 5_000;

function cleanup(windowMs: number) {
  if (store.size < CLEANUP_THRESHOLD) return;
  const cutoff = Date.now() - windowMs;
  for (const [key, timestamps] of store) {
    if (timestamps.every((t) => t <= cutoff)) {
      store.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Checks whether a given key is within the rate limit.
 *
 * @param key     - Unique identifier, e.g. "ip:endpoint"
 * @param limit   - Max requests allowed in the window
 * @param windowMs - Window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  const existing = store.get(key) ?? [];
  const active = existing.filter((t) => t > windowStart);

  if (active.length >= limit) {
    const oldest = active[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      resetAt: oldest + windowMs,
    };
  }

  active.push(now);
  store.set(key, active);

  cleanup(windowMs);

  return {
    allowed: true,
    remaining: limit - active.length,
    resetAt: now + windowMs,
  };
}

/**
 * Extracts the real client IP from Next.js request headers.
 * Handles Vercel, Cloudflare, and direct connections.
 */
export function extractClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return (
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    "unknown"
  );
}
