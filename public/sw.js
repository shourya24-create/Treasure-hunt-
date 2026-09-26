// ECHO service worker: keeps the app shell and media playable with no signal.
// API calls are never cached here; the client keeps its last good state and an
// IndexedDB answer queue itself (lib/offline-client.ts).
const VERSION = 'echo-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin') || url.pathname.startsWith('/c/')) return;

  // Immutable build assets and puzzle media: cache first.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/media/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Pages: network first, fall back to the last copy we saw.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(url.pathname)
            .then((hit) => hit || caches.match('/play'))
            .then((hit) => hit || new Response('Signal lost. Reopen ECHO when you have coverage.', { headers: { 'Content-Type': 'text/plain' } })),
        ),
    );
  }
});
