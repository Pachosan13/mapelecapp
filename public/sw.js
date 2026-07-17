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

// ⚠️ SUBIR ESTA VERSIÓN en CADA deploy que cambie una página del técnico (formularios, visita).
// El caché de páginas lleva la versión en el nombre; si no cambia, un técnico con la app ya
// abierta sigue viendo la página CACHEADA vieja hasta que el caché expire solo. Eso le pasó a
// William en Torre BAC (15-jul): llenó un formulario nuevo mergeado ese día contra una página
// del 10-jul cacheada → el autosave de esa versión no cubría el form nuevo y no guardó nada.
const VERSION = "semco-v3";
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
          // Solo cachear la página REAL: no rebotes a /login ni respuestas no-OK.
          // Si cacheáramos el login, offline mostraríamos el login en vez de la visita.
          const finalUrl = new URL(fresh.url || request.url, self.location.origin);
          const cacheable =
            fresh.ok &&
            fresh.status === 200 &&
            !fresh.redirected &&
            finalUrl.pathname !== "/login";
          if (cacheable) {
            const cache = await caches.open(PAGES_CACHE);
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch {
          // ignoreVary: Next agrega cabeceras Vary (RSC, Next-Router-*) que harían
          // fallar el match aunque la página SÍ esté cacheada. La ignoramos.
          const cached = await caches.match(request, { ignoreVary: true });
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
        const cached = await caches.match(request, { ignoreVary: true });
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

// Precalentado de páginas: el cliente (online) nos pide guardar los documentos que el
// técnico va a necesitar sin señal (la visita actual y /tech/today). Así, si sale del
// app y vuelve a entrar en un sótano, la navegación cae a esta copia y puede continuar.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "WARM_PAGES" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES_CACHE);
      await Promise.all(
        data.urls.map(async (u) => {
          try {
            const res = await fetch(u, { credentials: "same-origin" });
            const finalUrl = new URL(res.url || u, self.location.origin);
            if (
              res.ok &&
              res.status === 200 &&
              !res.redirected &&
              finalUrl.pathname !== "/login"
            ) {
              await cache.put(new Request(u), res.clone());
            }
          } catch {
            // sin señal o error: no pasa nada, se intentará de nuevo al reabrir online.
          }
        })
      );
    })()
  );
});
