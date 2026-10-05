/* Field Kit service worker: keeps the app itself on the phone so it opens with no signal.
 * Data never passes through here — the app talks to Apps Script directly. Bump V to ship an update. */
const V = 'fieldkit-1.1.0';
const FILES = ['./', './index.html', './app.js', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(V).then((c) => c.addAll(FILES))); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => {
    const net = fetch(e.request).then((r) => { if (r.ok) caches.open(V).then((c) => c.put(e.request, r.clone())); return r; }).catch(() => hit);
    return hit || net;
  }));
});
