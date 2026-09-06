// Service worker yomikai PWA: оболочка работает офлайн (network-first с кэшем).
const CACHE = "yomikai-pwa-v1";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Навигация: сеть, при офлайне — кэш главной
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const c = r.clone();
          caches.open(CACHE).then((cache) => cache.put(req, c));
          return r;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match("./index.html"))),
    );
    return;
  }
  // Ассеты своего origin: cache-first
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((r) => {
            if (r && r.status === 200) {
              const c = r.clone();
              caches.open(CACHE).then((cache) => cache.put(req, c));
            }
            return r;
          }),
      ),
    );
  }
});
