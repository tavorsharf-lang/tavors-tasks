// Minimal offline shell for tavors-tasks.
//
// The app auto-deploys on every build, so serving a stale index.html would pin
// the user to an old bundle. Strategy:
//   - navigations: network first, fall back to the cached shell when offline
//   - /assets/*: cache first — filenames are content-hashed, so they never change
// Anything else falls through to the network untouched.

const CACHE = 'tavors-v1';
const SHELL = './index.html';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase, Google APIs, fonts

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(resp => {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(SHELL, copy));
          return resp;
        })
        .catch(() => caches.match(SHELL))
    );
    return;
  }

  if (url.pathname.includes('/assets/')) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(resp => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return resp;
      }))
    );
  }
});
