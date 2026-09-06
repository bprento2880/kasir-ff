/* ============================================================
 *  Kasir FF — Service Worker
 *  Strategi: stale-while-revalidate.
 *  Render instan dari cache, versi baru ditarik diam-diam di background.
 * ========================================================== */

const CACHE_VER = 'ff-pos-v6';

/* Sengaja minimalis. Satu URL yang 404 bikin addAll gagal total
   dan Service Worker tidak pernah ter-install — gagalnya diam-diam. */
const PRECACHE = ['./', './index.html'];

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

  e.respondWith(
    caches.open(CACHE_VER).then(function (cache) {
      return cache.match(req).then(function (cached) {

        const jaringan = fetch(req).then(function (res) {
          // response opaque (font lintas domain) tetap disimpan, statusnya selalu 0
          if (res && (res.ok || res.type === 'opaque')) {
            cache.put(req, res.clone());
          }
          return res;
        }).catch(function () {
          return cached || Response.error();
        });

        // Ada di cache: sajikan sekarang juga, pembaruan jalan di belakang.
        // Tidak ada: tunggu jaringan.
        return cached || jaringan;
      });
    })
  );
});
