// Service Worker - Jardines de la Paz | Funciona con y sin internet
const CACHE_NAME = 'jardines-de-la-paz-v2';
const PRECACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './network.js',
  './manifest.json',
  './librerias/sweetalert2.all.min.js',
  './librerias/sweetalert2.min.css',
  './librerias/lucide.min.js',
  './librerias/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

// Instalación: guardar caché para uso offline (local + html2canvas CDN)
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const local = PRECACHE.filter((u) => u.startsWith('./') || !u.startsWith('http'));
      const cdn = PRECACHE.filter((u) => u.startsWith('http'));
      return cache.addAll(local).then(() => {
        return Promise.allSettled(cdn.map((u) => cache.add(u)));
      }).catch(() => {});
    })
  );
});

// Activar: tomar control y limpiar caches viejos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        .then(() => self.clients.claim());
    })
  );
});

// Fetch: red primero; si falla (sin internet), servir desde caché
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (!url.startsWith('http')) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        if (res.ok && (url.startsWith(self.location.origin) || url.includes('cdnjs.cloudflare.com'))) {
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
      .then((res) => res || new Response('', { status: 404, statusText: 'Not Found' }))
  );
});
