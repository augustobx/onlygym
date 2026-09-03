// OnlyGym PWA Service Worker
const CACHE_NAME = "onlygym-static-v4";
const OFFLINE_URL = "/offline.html";
const PRECACHE_ASSETS = [
  OFFLINE_URL,
  "/manifest.json",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

function safePortalPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/portal/dashboard";
  }
  try {
    const resolved = new URL(value, self.location.origin);
    return resolved.origin === self.location.origin ? `${resolved.pathname}${resolved.search}${resolved.hash}` : "/portal/dashboard";
  } catch {
    return "/portal/dashboard";
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Las páginas autenticadas y las APIs siempre salen de red. Si no hay red,
  // mostramos una pantalla neutra y nunca una ficha personal cacheada.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  if (url.pathname.startsWith("/api/")) return;

  const isStaticAsset = url.pathname.startsWith("/_next/static/") || PRECACHE_ASSETS.includes(url.pathname);
  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "OnlyGym", body: "Tenés una nueva notificación de tu gimnasio.", url: "/portal/dashboard" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }

  const requestedPath = safePortalPath(data.url);
  event.waitUntil(
    self.registration.showNotification(data.title || "OnlyGym", {
      body: data.body || "Tenés una nueva notificación.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: requestedPath },
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = safePortalPath(event.notification.data?.url);
  const target = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    }),
  );
});
