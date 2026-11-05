/* 简易离线缓存：网络优先，失败回退缓存 */
const CACHE = 'starfall-v6';
const ASSETS = ['./', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icon.svg',
  'js/util.js', 'js/data.js', 'js/audio.js', 'js/sprites.js', 'js/vfx.js', 'js/icons.js', 'js/input.js', 'js/map.js', 'js/game.js',
  'js/weapons.js', 'js/features.js', 'js/quests.js', 'js/render.js', 'js/ui.js', 'js/main.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
    return r;
  }).catch(() => caches.match(e.request)));
});
