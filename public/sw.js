const SHELL_CACHE = 'tagonce-shell-v1';
const RUNTIME_CACHE = 'tagonce-runtime-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];

async function cacheCurrentBuild() {
  const cache = await caches.open(SHELL_CACHE);
  await cache.addAll(APP_SHELL);

  try {
    const response = await fetch('/index.html', { cache: 'no-store' });
    if (!response.ok) return;
    const html = await response.clone().text();
    await cache.put('/index.html', response);

    const assetPaths = Array.from(
      html.matchAll(/(?:src|href)=["'](\.?\/assets\/[^"']+)["']/g),
      (match) => new URL(match[1], self.location.origin).pathname,
    );
    await Promise.allSettled(assetPaths.map((path) => cache.add(path)));
  } catch {
    // The basic shell remains cached even if asset discovery is temporarily unavailable.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheCurrentBuild().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => ![SHELL_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    return (await caches.match('/index.html')) || (await caches.match('/'));
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (
    url.pathname.startsWith('/assets/')
    || url.pathname === '/favicon.svg'
    || url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(cacheFirstAsset(request));
  }
});
