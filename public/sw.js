const CACHE = 'smartsell-management-v4';
const APP = '/smartsell-management/';
const isStaticAsset = url => url.pathname.startsWith(`${APP}assets/`);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([
    APP, `${APP}manifest.webmanifest`, `${APP}brand/app-icon-192.png`, `${APP}brand/app-icon-512.png`,
  ])).then(() => self.skipWaiting()));
});

// Retain downloaded hashed files for tabs opened before a deploy.
// Do not erase other applications' caches or force-reload unsaved forms.
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(APP)) return;
  // Cache only public application files, never APIs or user data.
  if (request.mode !== 'navigate' && !isStaticAsset(url) && !url.pathname.startsWith(`${APP}brand/`) && !url.pathname.endsWith('.webmanifest')) return;
  const cached = async () => {
    const current = await caches.open(CACHE);
    const response = await current.match(request);
    if (response?.ok) return response;
    const old = await caches.match(request);
    return old?.ok ? old : undefined;
  };
  const network = async () => {
    const response = await fetch(request);
    // A missing chunk must never poison the offline cache.
    if (response.ok && response.type !== 'opaque') {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  };
  event.respondWith((async () => {
    if (isStaticAsset(url)) {
      const response = await cached();
      if (response) return response;
      try { return await network(); } catch { return Response.error(); }
    }
    try { return await network(); } catch {
      const response = await cached();
      if (response) return response;
      if (request.mode === 'navigate') {
        const cache = await caches.open(CACHE);
        return (await cache.match(APP)) || Response.error();
      }
      return Response.error();
    }
  })());
});
