/* Offline support: keep the app and all content on the phone. */
const CACHE = 'ftg-v2.9';
const SHELL = [
  './',
  'index.html',
  'app.css',
  'app.css?v=2.9',
  'app.js',
  'app.js?v=2.9',
  'pompeii-art.js',
  'pompeii-art.js?v=2.9',
  'pompeii-compare.html',
  'content.json',
  'preread.json',
  'shelf.json',
  'img/barcelona.jpg',
  'img/madrid.jpg',
  'img/segovia.jpg',
  'img/marseille.jpg',
  'img/genoa.jpg',
  'img/pompeii.jpg',
  'img/tunis.jpg',
  'img/palermo.jpg',
  'img/sevilla.jpg',
  'img/guadix.jpg',
  'img/alhambra.jpg',
  'img/cordoba.jpg',
  'img/ship.jpg',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'itinerario.html'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // uploads and Google go straight to the network
  // Network first (so updates arrive), fall back to the cached copy when offline.
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
