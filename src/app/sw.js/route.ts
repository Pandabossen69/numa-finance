import { resolveSwBuildId } from "@/lib/pwa/build-id";

const BUILD_ID = resolveSwBuildId();

/**
 * NextStep-style update contract for installed home-screen apps:
 * - Never cache HTML/RSC (navigations pass through to the network).
 * - skipWaiting + clients.claim so a new deploy activates immediately.
 * - BUILD_ID is inlined so each production deploy changes /sw.js bytes and
 *   browsers update the existing registration (stable URL, no ?v=).
 * Hashed /_next/static assets may be cache-first; cache name is versioned
 * so activate wipes the previous deploy's entries.
 */
const WORKER = `/* numa-sw ${BUILD_ID} */
const STATIC_CACHE = "numa-static-${BUILD_ID}";

function isStaticAsset(url) {
  const path = url.pathname;
  return (
    path.startsWith("/_next/static/") ||
    path.startsWith("/icons/") ||
    path === "/favicon.ico" ||
    path === "/apple-touch-icon.png"
  );
}

function isRscOrDocument(request, url) {
  if (request.mode === "navigate") return true;
  if (url.searchParams.has("_rsc")) return true;
  if (request.headers.has("RSC")) return true;
  if (request.headers.has("Next-Router-Prefetch")) return true;
  if (request.headers.has("Next-Router-State-Tree")) return true;
  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Like NextStep: navigations always hit the network so a restart picks up
  // the latest HTML/RSC shell. We go further and never intercept them.
  if (isRscOrDocument(request, url)) return;
  if (!isStaticAsset(url)) return;

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
`;

export const dynamic = "force-static";

export function GET() {
  return new Response(WORKER, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
