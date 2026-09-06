/* ============================================================
 *  Kasir FF — Service Worker
 *  Strategi: stale-while-revalidate.
 *  Render instan dari cache, versi baru ditarik diam-diam di background.
 * ========================================================== */

const CACHE_VER = 'ff-pos-v7';

/* Sengaja minimalis. Satu URL yang 404 bikin addAll gagal total
   dan Service Worker tidak pernah ter-install — gagalnya diam-diam. */
const PRECACHE = ['./', './index.html'];

/* Kirim kabar ke semua tab yang terbuka. includeUncontrolled dipakai supaya
   tab yang belum dikuasai SW ini pun tetap kebagian pesan. */
function beritahuKlien_(pesan) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(function (list) {
      list.forEach(function (c) { c.postMessage(pesan); });
    });
}
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_VER)
      .then(function (c) { return c.addAll(PRECACHE); })
      .then(function () { return self.skipWaiting(); })   // jangan nunggu tab lama ditutup
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          return k === CACHE_VER ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })  // langsung ambil alih tab yang terbuka
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com/.test(url.hostname) ||
                 /\.(woff2?|ttf|otf)$/i.test(url.pathname);

  if (!sameOrigin && !isFont) return;   // panggilan API ke Apps Script biarkan lewat apa adanya

  // Cuma rangka app yang dipantau perubahannya — gambar/font berubah itu wajar
  // dan tidak perlu bikin notifikasi muncul.
  const adalahShell = req.mode === 'navigate' ||
                      url.pathname.endsWith('/') ||
                      /\.html?$/i.test(url.pathname);

  e.respondWith(
    caches.open(CACHE_VER).then(function (cache) {
      return cache.match(req).then(function (cached) {

        const jaringan = fetch(req).then(function (res) {
          if (res && (res.ok || res.type === 'opaque')) {
            if (cached && adalahShell) {
              const lama = cached.headers.get('ETag') || cached.headers.get('Last-Modified') || '';
              const baru = res.headers.get('ETag') || res.headers.get('Last-Modified') || '';
              if (lama && baru && lama !== baru) beritahuKlien_({ type: 'VERSI_BARU' });
            }
            cache.put(req, res.clone());
          }
          return res;
        }).catch(function () {
          return cached || Response.error();
        });

        return cached || jaringan;
      });
    })
  );
});
