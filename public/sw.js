/* Intentionally inert. NUMA disables service-worker registration in the app
 * (see PwaRegister) after a production incident where HTML/RSC caching blanked
 * pages and killed client interactions on iOS Safari / PWA.
 *
 * This file remains so old clients that still point at /sw.js get a no-op
 * worker that does not intercept fetches, then can be unregistered by the app.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// No fetch handler — network only.
