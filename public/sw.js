const CACHE_VERSION = 1;
const CACHE_NAME = `fc-static-v${CACHE_VERSION}`;

const STATIC_EXTENSIONS = /\.(js|css|woff2?|ttf|eot|png|jpg|jpeg|gif|svg|ico|webp)$/;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("fc-static-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never intercept non-GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept API routes or auth endpoints
  if (url.pathname.startsWith("/api/")) return;

  // Never intercept HTML navigation requests
  if (request.mode === "navigate") return;

  // Only cache static assets matched by extension
  if (!STATIC_EXTENSIONS.test(url.pathname)) return;

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          // Only cache successful responses
          if (!response.ok) return response;

          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        }),
    ),
  );
});
