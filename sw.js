const CACHE_NAME = 'tracker-v1';
const ASSETS = [
  './tracker.html',
  './manifest.json',
  'https://i.imgur.com/vHq05YF.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
