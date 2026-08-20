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

// La versión sale de la URL con que se registra el SW (`/sw.js?v=<buildId>`, ver
// app/ServiceWorkerRegister.tsx). Cambia SOLA en cada deploy — no hay que acordarse.
//
// Antes era una constante a mano con un aviso de "subirla en cada deploy". Falló dos veces:
// el 15-jul (William en Torre BAC llenó un formulario nuevo contra una página del 10-jul
// cacheada y el autosave viejo no lo guardó) y el 20-jul (el commit 31f2632 cambió la
// pantalla del técnico sin subir la versión → las tablets siguieron sirviendo el HTML del
// 17-jul, cuyos chunks de JS ya no existían tras el deploy → pantalla en blanco en campo).
//
// Por qué el query string y no el contenido del archivo: el navegador solo reinstala el SW
// si cambia el BYTE del script o su URL. Con la versión adentro había que editar el archivo;
// con `?v=` la URL cambia sola en cada build y la reinstalación queda garantizada.
const VERSION =
  new URL(self.location.href).searchParams.get("v") || "dev";
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
// Extrae del HTML los assets de /_next/static/ y los mete al caché estático.
// Se salta los que ya están: entre páginas comparten casi todos los chunks.
async function warmAssetsOf(response) {
  try {
    const html = await response.text();
    const encontrados = new Set();
    const re = /["'(\s](\/_next\/static\/[^"'()\s\\]+)/g;
    let m;
    while ((m = re.exec(html)) !== null) encontrados.add(m[1]);
    if (encontrados.size === 0) return;
    const cache = await caches.open(STATIC_CACHE);
    await Promise.all(
      Array.from(encontrados).map(async (ruta) => {
        try {
          if (await cache.match(ruta)) return;
          const r = await fetch(ruta, { credentials: "same-origin" });
          if (r.ok && r.status === 200) await cache.put(ruta, r.clone());
        } catch {
          // best-effort
        }
      })
    );
  } catch {
    // best-effort
  }
}

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
              // Y sus chunks de JS/CSS. Cachear SOLO el documento no alcanza: offline el
              // HTML sale del caché, pide /_next/static/... que nunca se descargó (el
              // técnico jamás renderizó esa página con señal) y React no monta — sale
              // "Application error", que es la misma pantalla en blanco del 20-jul.
              // Verificado el 20-ago: el caché estático traía el chunk de /tech/today
              // pero no el de /tech/visits/[id].
              await warmAssetsOf(res.clone());
            }
          } catch {
            // sin señal o error: no pasa nada, se intentará de nuevo al reabrir online.
          }
        })
      );
    })()
  );
});
