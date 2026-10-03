const CACHE = 'smartsell-apps-v3-5';
const APP = '/smartsell-management/';
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([APP, `${APP}manifest.webmanifest`, `${APP}brand/app-icon-192.png`, `${APP}brand/app-icon-512.png`])).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then(response => response || (event.request.mode === 'navigate' ? caches.match(APP) : Response.error()))));
});
