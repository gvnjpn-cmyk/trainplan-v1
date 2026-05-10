const CACHE = "trainplan-v1";
const ASSETS = ["/", "/index.html"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

self.addEventListener("push", e => {
  const data = e.data?.json() ?? { title: "TrainPlan", body: "Waktunya latihan!" };
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: "/favicon.svg", badge: "/favicon.svg",
    vibrate: [200, 100, 200], tag: "trainplan-notif", renotify: true,
  }));
});
