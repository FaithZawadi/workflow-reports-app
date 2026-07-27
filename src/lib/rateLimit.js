// A small in-memory rate limiter to blunt password brute-forcing on the login
// endpoints. Fixed-window counter keyed by IP and by email. It lives in the
// single app process (fine for one container); if you scale to multiple
// instances, move this to Redis. Fails open on any internal error — it must
// never lock people out because of a bug.

const buckets = new Map(); // key -> { count, resetAt }
let lastSweep = 0;

function sweep(now) {
  // Occasionally drop expired buckets so the map can't grow unbounded.
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

// Returns { ok: true } or { ok: false, retryAfter: <seconds> }.
export function hit(key, { limit = 5, windowMs = 15 * 60 * 1000 } = {}) {
  try {
    const now = Date.now();
    sweep(now);
    const b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true };
    }
    b.count += 1;
    if (b.count > limit) return { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

// Clear the counters for a key (call on a successful login so a legitimate user
// isn't penalised for earlier typos).
export function reset(key) {
  try {
    buckets.delete(key);
  } catch {}
}

// Best-effort client IP from the proxy chain (Nginx Proxy Manager sets
// X-Forwarded-For / X-Real-IP).
export function clientIp(req) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
