// Service worker (built into dist/sw.js by the plugin in vite.config.ts, with
// a fresh BUILD_ID per build so every deploy installs a new worker).
//
// What it does:
//   - pages: network first; offline, the last app shell is served so the
//     storefront still opens (and shows what's cached)
//   - /assets (hashed file names, never change) and /icons: cache first
//   - /api, sitemap, robots and anything cross-origin: never touched
const BUILD_ID = "__BUILD_ID__";
const SHELL_CACHE = `shell-${BUILD_ID}`;
const ASSET_CACHE = "assets";
const MAX_ASSETS = 150;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(["/", "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

async function trimAssets() {
  const cache = await caches.open(ASSET_CACHE);
  const keys = await cache.keys(); // oldest first
  for (const request of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) {
    await cache.delete(request);
  }
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== SHELL_CACHE && key !== ASSET_CACHE) await caches.delete(key);
      }
      await trimAssets();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/sitemap.xml" || url.pathname === "/robots.txt") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Every route serves the same shell; keep the newest one for offline use.
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(async () => (await caches.match("/", { cacheName: SHELL_CACHE })) || Response.error()),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
  }
});
