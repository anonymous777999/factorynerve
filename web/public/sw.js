const BUILD_VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_PREFIX = "dpr-shell-";
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // Only cache offline-safe assets here. Auth-aware HTML shells must stay network-driven.
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isServiceWorkerBypassedPath(url) {
  if (url.pathname.startsWith("/api/auth/")) return true;
  if (url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/")) return true;
  if (url.pathname === "/entry" || url.pathname.startsWith("/entry/")) return true;
  return false;
}

function isRuntimeAsset(request, url) {
  if (url.pathname.startsWith("/_next/static/")) return true;
  if (url.pathname.startsWith("/icons/")) return true;
  return ["style", "script", "worker", "font"].includes(request.destination);
}

async function putIfCacheable(cache, request, response) {
  if (!response || !response.ok) {
    return response;
  }
  const cacheControl = response.headers.get("cache-control") || "";
  if (cacheControl.includes("no-store")) {
    return response;
  }
  await cache.put(request, response.clone());
  return response;
}

async function networkNavigate(request) {
  try {
    return await fetch(request);
  } catch {
    const offline = await caches.match(OFFLINE_URL);
    return offline || Response.error();
  }
}

async function networkFirstAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    return await putIfCacheable(cache, request, response);
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (isServiceWorkerBypassedPath(url)) return;
  if (url.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    // Never cache navigations. Cached HTML caused stale auth shells and chunk mismatches on Android.
    event.respondWith(networkNavigate(event.request));
    return;
  }

  if (isRuntimeAsset(event.request, url)) {
    event.respondWith(networkFirstAsset(event.request));
  }
});
