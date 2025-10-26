/* 基本的な App Shell キャッシュ（静的アセットをキャッシュファースト） */
const CACHE_NAME = 'pwa-memo-links-v1';
const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './db.js',
  './manifest.webmanifest',
  // アイコンは存在する場合のみキャッシュ（無くてもOK）
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// ナビゲーションはキャッシュ優先（オフライン起動を確実に）
self.addEventListener('fetch', (e) => {
  const req = e.request;

  // 同一オリジンの GET のみを対象
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // App shell はキャッシュファースト
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        // 将来的な更新に備えて動的に保存（失敗しても無視）
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(()=>{});
        return res;
      }))
    );
    return;
  }

  // 外部へのリンク（ボタン先）は SW で触らず、そのままネットワーク
});
