/* Offline support: keep the app and all content on the phone. */
const CACHE = 'ftg-v2.16';
const SHELL = [
  './',
  'index.html',
  'app.css',
  'app.css?v=2.16',
  'app.js',
  'app.js?v=2.16',
  'pompeii-art.js',
  'pompeii-art.js?v=2.16',
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
  'img/pompeii/pompeii_photos.json',
  'img/pompeii/ar_foro_1.jpg',
  'img/pompeii/ar_foro_2.jpg',
  'img/pompeii/ar_foro_4.jpg',
  'img/pompeii/ar_thermo_bar.jpg',
  'img/pompeii/ar_street_v.jpg',
  'img/pompeii/ar_fountain.jpg',
  'img/pompeii/ar_forum_grand.jpg',
  'img/pompeii/ar_street_litter.jpg',
  'img/pompeii/foro_3_past.jpg',
  'img/pompeii/foro_3_present.jpg',
  'img/pompeii/apollo_1_past.jpg',
  'img/pompeii/apollo_1_present.jpg',
  'img/pompeii/arch_1_past.jpg',
  'img/pompeii/arch_1_present.jpg',
  'img/pompeii/street_2_past.jpg',
  'img/pompeii/street_2_present.jpg',
  'img/pompeii/street_3_past.jpg',
  'img/pompeii/street_3_present.jpg',
  'img/pompeii/street_4_past.jpg',
  'img/pompeii/street_4_present.jpg',
  'img/pompeii/step_1_past.jpg',
  'img/pompeii/step_1_present.jpg',
  'img/pompeii/thermopolium_1_past.jpg',
  'img/pompeii/thermopolium_1_present.jpg',
  'img/pompeii/fastfood_1_past.jpg',
  'img/pompeii/fastfood_1_present.jpg',
  'img/pompeii/villa_1_past.jpg',
  'img/pompeii/villa_1_present.jpg',
  'img/pompeii/aerial_2_past.jpg',
  'img/pompeii/aerial_2_present.jpg',
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
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.indexOf('/pod/') !== -1 || e.request.headers.has('range')) return; // uploads and Google go straight to the network
  // Network first (so updates arrive), fall back to the cached copy when offline.
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});