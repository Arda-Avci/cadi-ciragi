// Çevrimdışı çalışma: kod ve sayfa önce ağdan (güncel sürüm), görseller önce önbellekten.
const CACHE = 'hexling-v161';
const CORE = ['index.html', 'manifest.webmanifest', 'dist/main.js', 'dist/minis.js', 'dist/game.js', 'dist/data.js', 'dist/audio.js', 'dist/settings.js', 'dist/i18n.js', 'dist/scenery.js', 'dist/version.js', 'dist/billing.js', 'dist/ads.js', 'dist/fight.js', 'dist/hof.js', 'dist/house.js', 'dist/meta.js', 'dist/quests.js', 'dist/story.js', 'dist/tiger.js', 'dist/notify.js', 'dist/mine.js', 'dist/mine3d.js', 'vendor/three.min.js', 'assets/manifest.json', 'assets/title_bg.jpg', 'assets/arena_bg.jpg', 'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  // yalnızca çekirdek dosyalar beklenir: yeni sürüm hemen etkinleşir. Yüzlerce görsel arka planda önbelleğe alınır (yarım kalırsa istek anında alınır).
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    self.skipWaiting();
    (async () => {
      try {
        const names = await (await fetch('assets/manifest.json')).json();
        for (const n of names) await cache.add('assets/' + n + '.png').catch(() => undefined);
      } catch (err) {
        console.error('görsel listesi önbelleğe alınamadı', err);
      }
    })();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  const url = new URL(e.request.url);
  // sayfa ve kod dosyaları: önce ağ (yeni sürüm hemen görünür), ağ yoksa ya da 4 sn'de gelmezse önbellek; görseller: önce önbellek
  const fresh = e.request.mode === 'navigate' || /\.(js|html|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((r) => { if (r.ok) cache.put(e.request, r.clone()); return r; });
    if (fresh) {
      const timeout = new Promise((res) => setTimeout(() => res(hit), 4000));
      try { return (await Promise.race([net, timeout])) || (await net); } catch (err) { if (hit) return hit; throw err; }
    }
    net.catch(() => undefined);
    return hit || net;
  })());
});
