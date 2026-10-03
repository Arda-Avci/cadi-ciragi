// Çevrimdışı çalışma: önce önbellek, arkada güncelle (stale-while-revalidate).
const CACHE = 'hexling-v63';
const CORE = ['index.html', 'manifest.webmanifest', 'dist/main.js', 'dist/game.js', 'dist/data.js', 'dist/audio.js', 'dist/settings.js', 'dist/i18n.js', 'dist/scenery.js', 'dist/version.js', 'dist/billing.js', 'dist/ads.js', 'dist/fight.js', 'dist/house.js', 'dist/meta.js', 'dist/quests.js', 'dist/story.js', 'dist/tiger.js', 'dist/notify.js', 'dist/mine.js', 'dist/mine3d.js', 'vendor/three.min.js', 'assets/manifest.json', 'assets/title_bg.jpg', 'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    try {
      const names = await (await fetch('assets/manifest.json')).json();
      await Promise.all(names.map((n) => cache.add('assets/' + n + '.png').catch(() => undefined)));
    } catch (err) {
      console.error('görsel listesi önbelleğe alınamadı', err);
    }
    self.skipWaiting();
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
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((r) => { if (r.ok) cache.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  })());
});
