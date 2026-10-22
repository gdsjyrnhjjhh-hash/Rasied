/* Service Worker — رصيد (PWA)
   - التنقل والـ CSS/JS: الشبكة أولًا (دائمًا أحدث نسخة) وعند انقطاع الإنترنت من الكاش.
   - الخطوط والصور ومكتبة Supabase المثبّتة الإصدار: الكاش أولًا (سريعة).
   - لا يعترض أي طلب لواجهة Supabase أو أي دومين آخر → البيانات دائمًا مباشرة من السيرفر. */
const VERSION = "raseed-v36";
const STATIC = VERSION + "-static";
const RUNTIME = VERSION + "-runtime";
const PRECACHE = [
  "offline.html",
  "manifest.webmanifest",
  "favicon.ico",
  "css/style.css?v=36",
  "assets/fonts/Cairo-Regular.ttf",
  "assets/fonts/Cairo-SemiBold.ttf",
  "assets/fonts/Cairo-Bold.ttf",
  "assets/img/icon-192.png",
  "assets/img/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(STATIC);
    await Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.indexOf(VERSION) !== 0).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function putRuntime(req, res) {
  if (res && res.ok && res.type !== "opaque") {
    const c = await caches.open(RUNTIME);
    c.put(req, res.clone());
  }
  return res;
}

async function networkFirst(req) {
  try {
    return await putRuntime(req, await fetch(req));
  } catch (err) {
    const hit = await caches.match(req);
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  return putRuntime(req, await fetch(req));
}

async function navigate(req) {
  try {
    return await putRuntime(req, await fetch(req));
  } catch (err) {
    const hit = await caches.match(req, { ignoreSearch: true });
    return hit || (await caches.match("offline.html")) || Response.error();
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const lib = url.hostname === "cdn.jsdelivr.net";
  if (!same && !lib) return;               // Supabase وغيره: مباشرة بدون تدخل
  if (same && url.pathname.endsWith("/sw.js")) return;

  if (req.mode === "navigate") { e.respondWith(navigate(req)); return; }
  if (lib || (same && /\/assets\//.test(url.pathname))) { e.respondWith(cacheFirst(req)); return; }
  e.respondWith(networkFirst(req));
});
