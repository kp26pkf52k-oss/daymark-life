/* DAYMARK LIFE — オフライン用 Service Worker
 * ネットワーク優先：オンラインなら常に最新のファイルを取得し、取れないときだけ保存済みの控えを使う。
 * そのため、ファイルを更新して公開すれば、次に開いたときに新しい版が表示される。
 * ファイルを追加・改名したら ASSETS を更新し、CACHE の番号を上げる。
 */
const CACHE = 'daymark-v1.2.0';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/util.js', 'js/store.js', 'js/model.js', 'js/charts.js', 'js/ui.js', 'js/forms.js', 'js/app.js',
  'js/views/home.js', 'js/views/calendar.js', 'js/views/english.js', 'js/views/english-talk.js', 'js/views/english-eval.js', 'js/views/research.js', 'js/views/condition.js',
  'js/views/exercise.js', 'js/views/analysis.js', 'js/views/goals.js', 'js/views/settings.js',
  'icons/icon.svg', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
  );
});
