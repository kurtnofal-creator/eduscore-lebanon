/**
 * Simple in-memory rate limiter using a sliding-window counter.
 * Works for single-process deployments (dev + single-instance prod).
 * Swap the store for Redis in multi-instance production.
 */

interface Entry {
  count: number
  resetAt: number
}

const store = new Map<string, Entry>()

// Prune expired entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}, 5 * 60 * 1000)

/**
 * Check and increment a rate-limit counter.
 * @returns true if the request is allowed, false if it should be blocked (429).
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) return false

  entry.count++
  return true
}

/** Extract a stable client key from a Next.js request (IP or session). */
export function getClientKey(req: Request, suffix = ''): string {
  const forwarded = (req.headers as Headers).get('x-forwarded-for')
  const realIp    = (req.headers as Headers).get('x-real-ip')
  const ip        = forwarded?.split(',')[0]?.trim() ?? realIp ?? 'unknown'
  return suffix ? `${ip}:${suffix}` : ip
}
