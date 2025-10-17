const CACHE_NAME = 'olap-hotspot-v1';
const urlsToCache = [
  '/',
  '/about',
  '/assets/ipb.png',
  '/src/styles/global.css',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }

        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          (response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                if (event.request.url.includes('/assets/') ||
                    event.request.url.includes('/src/styles/') ||
                    event.request.url.includes('fonts.googleapis.com')) {
                  cache.put(event.request, responseToCache);
                }
              });

            return response;
          }
        ).catch(() => {
          if (event.request.url.includes('/api/hotspot')) {
            return new Response(
              JSON.stringify({ features: [], type: "FeatureCollection" }),
              {
                status: 200,
                statusText: 'OK',
                headers: { 'Content-Type': 'application/json' }
              }
            );
          }
        });
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});