/*
 * Service Worker SEMCO — shell offline para el trabajo de campo.
 *
 * Objetivo: que la app ABRA y funcione aunque el técnico recargue la página en un
 * sótano/foso sin señal. Complementa al outbox (lib/offline/outbox.ts): el outbox
 * salva la DATA; este SW salva la APP (HTML + JS + CSS) para poder mostrarla offline.
 *
 * Estrategia:
 *  - Navegaciones (recargar la visita): network-first → si falla, la copia cacheada
 *    de ESA misma URL → si no hay, la página offline. Online siempre trae lo fresco.
 *  - Assets de Next (/_next/static, hasheados = inmutables) + íconos: cache-first.
 *  - POST / server actions / Supabase / terceros: NUNCA se interceptan → van a la red.
 *    (Offline fallan y el outbox se encarga; nunca servimos una mutación desde caché.)
 */

const VERSION = "semco-v1";
const STATIC_CACHE = `semco-static-${VERSION}`;
const PAGES_CACHE = `semco-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/logosemco.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.endsWith(VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Solo GET: los server actions y mutaciones (POST) deben ir SIEMPRE a la red.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Solo mismo origen: Supabase y terceros pasan directo a la red.
  if (url.origin !== self.location.origin) return;

  // 1) Navegaciones (recargar la visita) → network-first con caída a caché.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(PAGES_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          return offline || Response.error();
        }
      })()
    );
    return;
  }

  // 2) Assets estáticos hasheados + íconos → cache-first.
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    PRECACHE.includes(url.pathname) ||
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font" ||
    request.destination === "image";

  if (isStaticAsset) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch {
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // 3) Resto (RSC payloads, APIs GET, etc.): no interceptar → red directa.
});
