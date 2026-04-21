const CACHE_VERSION = "2026-04-21-v3";
const SHELL_CACHE = `factorynerve-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `factorynerve-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `factorynerve-runtime-${CACHE_VERSION}`;
const ALL_CACHES = [SHELL_CACHE, STATIC_CACHE, RUNTIME_CACHE];
const AUTH_ROUTE_PREFIXES = ["/access", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];

const PRECACHE_ROUTES = [
  "/",
  "/dashboard",
  "/attendance",
  "/entry",
  "/ocr",
  "/ocr/scan",
  "/approvals",
  "/work-queue",
  "/reports",
  "/offline",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

const APP_SHELL_ROUTES = new Set([
  "/",
  "/dashboard",
  "/attendance",
  "/entry",
  "/ocr",
  "/ocr/scan",
  "/approvals",
  "/work-queue",
  "/reports",
  "/offline",
]);

function isAuthRoute(pathname) {
  return AUTH_ROUTE_PREFIXES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isCacheableResponse(response) {
  return Boolean(response && response.ok && (response.type === "basic" || response.type === "default"));
}

async function addToCache(cacheName, request, response) {
  if (!isCacheableResponse(response)) return response;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  return response;
}

async function matchDocumentFallback(request) {
  const exact = await caches.match(request, { ignoreSearch: true });
  if (exact) return exact;

  const url = new URL(request.url);
  const normalized = await caches.match(url.pathname);
  if (normalized) return normalized;

  return null;
}

function getNavigationFallback(pathname) {
  if (
    pathname === "/access" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/verify-email"
  ) {
    return pathname;
  }
  if (APP_SHELL_ROUTES.has(pathname)) {
    return pathname;
  }
  return "/offline";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ROUTES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !ALL_CACHES.includes(key)).map((key) => caches.delete(key))),
      )
      .then(async () => {
        const cacheKeys = await caches.keys();
        await Promise.all(
          cacheKeys.map(async (cacheKey) => {
            const cache = await caches.open(cacheKey);
            const requests = await cache.keys();
            await Promise.all(
              requests
                .filter((request) => {
                  try {
                    const url = new URL(request.url);
                    return url.origin === self.location.origin && isAuthRoute(url.pathname);
                  } catch {
                    return false;
                  }
                })
                .map((request) => cache.delete(request)),
            );
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === "GET_VERSION") {
    event.ports?.[0]?.postMessage({
      cacheVersion: CACHE_VERSION,
      shellCache: SHELL_CACHE,
      staticCache: STATIC_CACHE,
      runtimeCache: RUNTIME_CACHE,
    });
  }
});

async function networkFirst(request, { cacheName = RUNTIME_CACHE, fallbackUrl = "/offline" } = {}) {
  try {
    const response = await fetch(request);
    await addToCache(cacheName, request, response);
    return response;
  } catch {
    const cached = await matchDocumentFallback(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    return Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName = STATIC_CACHE) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });

  const networkPromise = fetch(request)
    .then((response) => addToCache(cacheName, request, response))
    .catch(() => cached || Response.error());

  return cached || networkPromise;
}

async function networkOnly(request, fallbackUrl = "/offline") {
  try {
    return await fetch(request, { cache: "no-store" });
  } catch {
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    if (isAuthRoute(url.pathname)) {
      event.respondWith(networkOnly(event.request, "/offline"));
      return;
    }
    event.respondWith(
      networkFirst(event.request, {
        cacheName: RUNTIME_CACHE,
        fallbackUrl: getNavigationFallback(url.pathname),
      }),
    );
    return;
  }

  const destination = event.request.destination;

  if (
    ["style", "script", "font", "image", "worker"].includes(destination) ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.json" ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(staleWhileRevalidate(event.request, STATIC_CACHE));
    return;
  }

  if (APP_SHELL_ROUTES.has(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event.request, RUNTIME_CACHE));
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => addToCache(RUNTIME_CACHE, event.request, response))
        .catch(() => caches.match("/offline"));
    }),
  );
});
