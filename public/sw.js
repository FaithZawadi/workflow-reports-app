// Service worker: install-to-home-screen + offline-capable shell + read-through
// caching of report/schedule data so past records are viewable offline. Report
// submissions are queued in IndexedDB by the page and forwarded when back online.
const CACHE = "qsl-v4";
const API_CACHE = "qsl-api-v1";
const SHELL = ["/dashboard", "/reports/new", "/login", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k !== API_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Read-only data endpoints worth caching so the registry, a report's details
// and the schedule still render with no connection. Never caches mutations,
// PDFs, exports or auth.
function isCacheableApiGet(req) {
  if (req.method !== "GET") return false;
  const p = new URL(req.url).pathname;
  if (p === "/api/reports/export") return false; // spreadsheet download
  if (p === "/api/reports") return true; // registry list
  if (p === "/api/schedules") return true; // schedule list
  if (p === "/api/clients") return true;
  if (p === "/api/users/directory") return true;
  if (/^\/api\/reports\/[^/]+$/.test(p)) return true; // a single report's detail
  return false;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;

  // Cacheable data GETs: network-first (fresh when online), fall back to the
  // last cached copy when offline.
  if (req.url.includes("/api/")) {
    if (isCacheableApiGet(req)) {
      e.respondWith(
        fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(API_CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => caches.match(req).then((hit) => hit || Response.error()))
      );
    }
    // All other API calls (mutations, PDF, auth) always go straight to network.
    return;
  }

  if (req.method !== "GET") return;

  // Navigations: network-first, fall back to a cached page so the app still
  // launches offline (query strings ignored on the fallback).
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(async () =>
          (await caches.match(req, { ignoreSearch: true })) ||
          (await caches.match("/dashboard")) ||
          (await caches.match("/login")) ||
          Response.error()
        )
    );
    return;
  }

  // Other GETs (assets): network-first with cache fallback.
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});
