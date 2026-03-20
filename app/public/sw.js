const CACHE_NAME = "olap-hotspot-v3";
const urlsToCache = [
  "/assets/ipb.webp",
  "/assets/kebakaran1.webp",
  "/assets/kebakaran2.webp",
  "https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;600;700;800;900&display=swap",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    }),
  );
  // Force new SW to activate immediately
  self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  // Skip navigation requests - let browser handle redirects normally
  if (event.request.mode === "navigate") {
    return;
  }

  // Only handle asset and API requests
  const url = event.request.url;
  const shouldHandle =
    url.includes("/assets/") ||
    url.includes("/src/styles/") ||
    url.includes("fonts.googleapis.com") ||
    url.includes("/api/v1/hotspots");

  if (!shouldHandle) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(event.request.clone())
        .then((response) => {
          if (
            !response ||
            response.status !== 200 ||
            response.type !== "basic"
          ) {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          if (url.includes("/api/v1/hotspots")) {
            return new Response(
              JSON.stringify({ features: [], type: "FeatureCollection" }),
              {
                status: 200,
                statusText: "OK",
                headers: { "Content-Type": "application/json" },
              },
            );
          }
        });
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        }),
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    }),
  );
});
