const CACHE_NAME = "ms-minutes-shell-v1";

self.addEventListener("install", (event) => {
  const shellUrl = new URL("./", self.registration.scope).toString();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.add(shellUrl))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("ms-minutes-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }
  const requestUrl = new URL(request.url);
  const scopeUrl = new URL(self.registration.scope);
  const apiPath = new URL("api/", self.registration.scope).pathname;
  if (requestUrl.origin !== scopeUrl.origin ||
      !requestUrl.pathname.startsWith(scopeUrl.pathname) ||
      requestUrl.pathname.startsWith(apiPath)) {
    return;
  }

  if (request.mode === "navigate") {
    const shellUrl = new URL("./", self.registration.scope).toString();
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(shellUrl, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(shellUrl)) || Response.error()),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
      return cached || network;
    }),
  );
});
