// Service worker: enables install-to-home-screen and an offline-capable shell.
// The app opens and the report form works with no connection; submissions are
// queued in IndexedDB by the page and forwarded when the network returns.
const CACHE = "qsl-v3";
const SHELL = ["/dashboard", "/reports/new", "/login", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // Never cache API calls — always go to network for live data. (POST /api/reports
  // failing offline is handled by the page's outbox, not here.)
  if (req.method !== "GET" || req.url.includes("/api/")) return;

  // Navigations (opening a page): network-first, then fall back to a cached
  // page so the app still launches offline. Query strings are ignored on the
  // fallback so /dashboard?queued=1 resolves to the cached /dashboard.
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
