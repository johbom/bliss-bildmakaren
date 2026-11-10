/**
 * Service worker för Bildmakaren (PWA): appen startar utan nät.
 *
 * Bara appens egna filer (SHELL) hanteras och cachas. Användarens bilder och foton finns aldrig här –
 * de ligger i IndexedDB på enheten – och alla andra anrop passerar orörda.
 *
 * Strategi som i glosor-sw.js: "stale-while-revalidate" – svara ur cachen och hämta en färsk kopia i
 * bakgrunden, så att en ändrad fil syns vid nästa start utan någon ruta om ny version. Höj VERSION bara
 * när fil-listan ändras (gamla cacher städas bort vid aktivering). Hämtningar går förbi HTTP-cachen.
 */
const VERSION = 'bildmakaren-v1';
const SHELL = [
  'bildmakaren.html',
  'bildmakaren.css',
  'bildmakaren.webmanifest',
  'src/bildmakaren-start.js',
  'src/bildmakaren.js',
  'src/bildmakaren-styrning.js',
  'src/bildmakaren-pwa.js',
  'src/glosor.js',
  'src/glosor-skriv.js',
  'src/vendor/bliss-data.js',
  'src/vendor/bliss-ritningar.js',
  'src/vendor/bliss-derivations.js',
  'src/vendor/bliss-lemma.js',
  'src/vendor/bliss-synonymer.js',
  'src/vendor/bliss-harledda.js',
  'src/vendor/bliss-former.js',
  'icons/bildmakaren.svg',
  'icons/bildmakaren-192.png',
  'icons/bildmakaren-512.png',
  'icons/bildmakaren-maskable-512.png',
  'icons/bildmakaren-apple-touch.png',
  'fonts/atkinson-hyperlegible-400-latin.woff2',
  'fonts/atkinson-hyperlegible-400-latin-ext.woff2',
  'fonts/atkinson-hyperlegible-700-latin.woff2',
  'fonts/atkinson-hyperlegible-700-latin-ext.woff2',
  'fonts/atkinson-hyperlegible-400i-latin.woff2',
  'fonts/atkinson-hyperlegible-400i-latin-ext.woff2',
];
const shellUrls = new Set(SHELL.map((p) => new URL(p, self.registration.scope).href));

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(SHELL.map((p) => new Request(p, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bildmakaren-v') && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const key = url.origin + url.pathname;
  if (!shellUrls.has(key)) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(key);
    const fresh = fetch(key, { cache: 'no-cache' }).then((res) => {
      if (res.ok) cache.put(key, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(fresh); return hit; }
    return (await fresh) || Response.error();
  }));
});
