const CACHE_NAME = 'quintaword-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './valid-words.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

// Files that change rarely, if ever — safe to serve from cache first, and
// only refetched when the network is actually unreachable.
const CACHE_FIRST_PATTERNS = [
  /icons\//,
  /valid-words\.json$/
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // word-config.json must always be fresh — never serve a cached copy.
  if (url.pathname.endsWith('word-config.json')) {
    event.respondWith(fetch(event.request));
    return;
  }

  const isCacheFirst = CACHE_FIRST_PATTERNS.some((pattern) => pattern.test(url.pathname));

  if (isCacheFirst) {
    // Cache-first: fine for assets that essentially never change.
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for everything else (index.html, manifest.json, etc.) —
  // this is the fix: previously these were cache-first, which meant an
  // install-time snapshot could get stuck forever and never update, even
  // after the live site changed. Now we always try the network first, and
  // only fall back to the cached copy if the network genuinely fails
  // (i.e. actually offline).
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok && event.request.method === 'GET') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
