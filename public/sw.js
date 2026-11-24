/* Hikma — offline & speed. Code and photos are cached; prices, stock and orders always come live from the API. */
const VERSION = 'hikma-v1';
const SHELL = `${VERSION}-shell`;
const IMAGES = `${VERSION}-images`;
const MAX_IMAGES = 160;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/manifest.webmanifest', '/mark.svg'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/api/')) return; // live data only

  // Pages: network first, the cached app when offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  // Built files (hashed names never change): cache first
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Product photos: show the saved copy instantly, refresh it in the background
  if (req.destination === 'image') {
    e.respondWith(
      caches.open(IMAGES).then(async (c) => {
        const hit = await c.match(req);
        const fresh = fetch(req)
          .then((res) => {
            if (res.ok || res.type === 'opaque') {
              c.put(req, res.clone());
              trim(IMAGES, MAX_IMAGES);
            }
            return res;
          })
          .catch(() => hit);
        return hit || fresh;
      }),
    );
  }
});
