/* NUMA PWA service worker — static assets only.
 * Never cache HTML / RSC / API: that breaks App Router navigations and can
 * leak authenticated shells across sessions.
 */
const CACHE = "numa-static-v3";
const PRECACHE = ["/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function shouldHandle(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;

  // Never intercept documents or Next.js data/RSC — always network.
  if (request.mode === "navigate") return false;
  if (request.destination === "document") return false;
  if (url.pathname.startsWith("/_next/")) return false;
  if (url.pathname.startsWith("/api/")) return false;
  if (url.searchParams.has("_rsc")) return false;

  const dest = request.destination;
  return (
    dest === "image" ||
    dest === "font" ||
    dest === "style" ||
    dest === "audio" ||
    dest === "video" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.startsWith("/icons/")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!shouldHandle(request)) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      } catch {
        return cached || Response.error();
      }
    }),
  );
});
