/* ============================================================
 *  SERVICE WORKER — Kasir Frozen Food
 *  Tugas: nyimpen kerangka app (HTML/font/ikon) di HP, supaya
 *  app tetap kebuka walau reload tanpa internet.
 *
 *  PENTING: naikkan CACHE_VER tiap kali index.html diubah,
 *  kalau tidak HP kasir akan terus pakai versi lama.
 * ========================================================== */
const CACHE_VER = 'ff-pos-v2';

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* ---------- pasang: simpan kerangka app ---------- */
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_VER)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

/* ---------- aktif: buang cache versi lama ---------- */
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          return k === CACHE_VER ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

/* ---------- ambil data ---------- */
self.addEventListener('fetch', function (e) {
  var req = e.request;

  // POST ke Apps Script (semua panggilan data) — jangan disentuh sama sekali.
  if (req.method !== 'GET') return;

  // Jangan pernah cache endpoint Apps Script, walau kebetulan GET.
  if (req.url.indexOf('script.google.com') > -1) return;

  e.respondWith(
    caches.match(req).then(function (hit) {
      // Sudah ada di HP → langsung pakai (ini yang bikin buka app terasa instan).
      if (hit) return hit;

      return fetch(req).then(function (res) {
        // Simpan buat dipakai lain kali. Font Google ikut ke-cache di sini.
        if (res && (res.status === 200 || res.type === 'opaque')) {
          var copy = res.clone();
          caches.open(CACHE_VER).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        // Offline dan belum pernah ke-cache. Kalau ini navigasi halaman,
        // kasih index.html supaya app tetap kebuka.
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
