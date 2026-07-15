/* service worker — קאשינג לאופליין */
const CACHE = 'gematria-v34';
const ASSETS = [
  './', './index.html', './css/styles.css',
  './js/gematria.js', './js/search.js', './js/ui.js',
  './manifest.json', './icon-192.png', './data/verses.v2.json', './data/values_list.json',
  './fonts/assistant-hebrew.woff2', './fonts/KeterYG-Medium.ttf', './fonts/assistant-latin.woff2',
];
self.addEventListener('install', e => {
  // cache:'reload' — עוקף את קאש ה-HTTP של הדפדפן, שאחרת עלול להזין גרסאות ישנות לקאש החדש
  e.waitUntil(caches.open(CACHE).then(c =>
    c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))
  ).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// אסטרטגיה: מעטפת האפליקציה (HTML/CSS/JS) = network-first → תמיד עדכני כשיש רשת,
//   נופל לקאש רק באופליין. נתונים גדולים/יציבים (JSON/פונטים) = cache-first (מהיר, לא משתנה).
function cacheFirst(req){
  return caches.match(req).then(hit => hit || fetch(req).then(res => {
    const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)).catch(()=>{});
    return res;
  }));
}
function networkFirst(req){
  return fetch(req).then(res => {
    const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)).catch(()=>{});
    return res;
  }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')));
}
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // קובץ ההתקנה (.apk או נתיב הפרוקסי /apk) — הורדה ישירה, בלי קאשינג של 5MB
  if (/\.apk$/.test(url.pathname) || /\/apk$/.test(url.pathname)) return;
  const bigStatic = /\/(data|fonts)\//.test(url.pathname) ||
    /\.(json|ttf|woff2?|png|svg)$/.test(url.pathname);
  e.respondWith(bigStatic ? cacheFirst(e.request) : networkFirst(e.request));
});
