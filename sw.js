const CACHE_NAME = 'quintaword-v4';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './valid-words.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon-180.png',
  './icons/apple-touch-icon-167.png',
  './icons/apple-touch-icon-152.png',
  './icons/apple-touch-icon-120.png'
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

  // Never intercept requests to other domains (the dictionary API, etc.) —
  // let the browser handle those completely natively. Service workers only
  // need to manage this site's own files; leaving third-party API calls
  // alone avoids any chance of this cache logic interfering with them.
  if (url.origin !== self.location.origin) {
    return;
  }

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
  // always try the network first, and only fall back to the cached copy if
  // the network genuinely fails (i.e. actually offline).
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
