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

// Las versiones viejas ya NO se borran al activar (24-sep-2026). Borrarlas de golpe le
// dejó a Edgar Zúñiga en P.H. VIVA PLAZA la pantalla de "sin conexión" sobre una visita
// que tenía abierta: el deploy de las 12:58 cambió la versión, su tablet terminó de
// instalar la nueva con la señal floja, el activate borró la copia guardada y no hubo
// señal para bajarla otra vez. Ahora la copia vieja se queda hasta que la versión nueva
// tiene TODAS esas páginas frescas (ver limpiarVersionesViejas).
//
// ⚠️ Por qué no volvemos al problema del 15/20-jul (HTML viejo con chunks inexistentes):
// la copia vieja se guarda JUNTO con su caché estático (mismo sufijo de versión), así que
// su HTML y su JS siguen siendo consistentes; y solo se sirve SIN señal — online manda
// siempre la red (network-first), y la navegación prefiere la copia de la versión actual.
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim().then(() => limpiarVersionesViejas()));
});

// Solo las páginas del técnico tienen que sobrevivir al deploy: son las que se abren sin
// señal en un sótano. Las de /ops y /dir se usan con señal (network-first igual las
// cachea al visitarlas), así que no se re-bajan ni frenan la limpieza de la versión vieja.
//
// 12-nov-2026: antes se re-bajaba TODO lo de la versión vieja, todo junto. El gerente que
// había abierto cientos de pantallas de /ops (cada equipo de cada edificio) disparaba
// cientos de renders a la vez tras el deploy del PR #21; las de equipos borrados daban 404,
// nunca entraban a la versión nueva y la tanda se repetía en cada cambio de pantalla.
// Supabase se saturó: 504 en todo /ops y William no pudo asignar una visita.
function necesitaRenovarse(pathname) {
  return pathname === "/tech" || pathname.startsWith("/tech/");
}

// Cuántas páginas se piden a la vez al precalentar. Son renders completos con consultas a
// la base: en paralelo sin tope saturan Supabase.
const PRECALENTADO_EN_PARALELO = 3;

async function enTandas(items, enParalelo, fn) {
  const cola = items.slice();
  const trabajadores = Array.from(
    { length: Math.min(enParalelo, cola.length) },
    async () => {
      while (cola.length > 0) await fn(cola.shift());
    }
  );
  await Promise.all(trabajadores);
}

// Una página que ya no existe (404/410: p. ej. un equipo borrado) nunca va a entrar a la
// versión nueva. Se suelta de las viejas para que no se vuelva a pedir en cada precalentado.
async function soltarDeVersionesViejas(u) {
  try {
    for (const k of await caches.keys()) {
      if (!k.startsWith("semco-pages-") || k === PAGES_CACHE) continue;
      const vieja = await caches.open(k);
      await vieja.delete(new Request(u), { ignoreVary: true });
    }
  } catch {
    // best-effort
  }
}

// Borra cada versión vieja SOLO cuando la actual ya tiene todas sus páginas del técnico.
// Corre al activar y después de cada precalentado. Las estáticas viejas sin páginas se van
// de una.
async function limpiarVersionesViejas() {
  try {
    const keys = await caches.keys();
    const actual = await caches.open(PAGES_CACHE);
    const viejas = keys.filter((k) => k.startsWith("semco-") && !k.endsWith(VERSION));
    const versionesViejas = new Set(viejas.map((k) => k.replace(/^semco-(pages|static)-/, "")));
    for (const v of versionesViejas) {
      const nombrePaginas = `semco-pages-${v}`;
      let cubiertas = true;
      if (keys.includes(nombrePaginas)) {
        const vieja = await caches.open(nombrePaginas);
        for (const req of await vieja.keys()) {
          if (!necesitaRenovarse(new URL(req.url).pathname)) continue;
          if (!(await actual.match(req, { ignoreVary: true }))) {
            cubiertas = false;
            break;
          }
        }
      }
      if (cubiertas) {
        await caches.delete(nombrePaginas);
        await caches.delete(`semco-static-${v}`);
      }
    }
  } catch {
    // best-effort
  }
}

// URLs que la versión vieja tenía guardadas y la actual todavía no: se re-bajan en el
// próximo precalentado con señal, para poder soltar la copia vieja.
async function paginasPorRenovar() {
  const salida = [];
  try {
    const actual = await caches.open(PAGES_CACHE);
    for (const k of await caches.keys()) {
      if (!k.startsWith("semco-pages-") || k === PAGES_CACHE) continue;
      const vieja = await caches.open(k);
      for (const req of await vieja.keys()) {
        const u = new URL(req.url);
        if (!necesitaRenovarse(u.pathname)) continue;
        if (!(await actual.match(req, { ignoreVary: true }))) {
          salida.push(u.pathname + u.search);
        }
      }
    }
  } catch {
    // best-effort
  }
  return salida;
}

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
          // Primero la copia de ESTA versión; si no hay, la de la anterior (con su JS);
          // y como último intento, la misma página sin query (`?saved=1` y similares
          // no deben dejar al técnico en la pantalla de "sin conexión").
          const actual = await caches.open(PAGES_CACHE);
          const cached =
            (await actual.match(request, { ignoreVary: true })) ||
            (await caches.match(request, { ignoreVary: true })) ||
            (await actual.match(request, { ignoreVary: true, ignoreSearch: true })) ||
            (await caches.match(request, { ignoreVary: true, ignoreSearch: true }));
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

// Las de la versión vieja se re-bajan UNA tanda a la vez: visibilitychange y pagehide
// llegan juntos y cada uno pediría la lista entera otra vez.
let renovandoVersionVieja = false;

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "WARM_PAGES" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES_CACHE);
      const renueva = !renovandoVersionVieja;
      if (renueva) renovandoVersionVieja = true;
      try {
        const urls = Array.from(
          new Set([...data.urls, ...(renueva ? await paginasPorRenovar() : [])])
        );
        await enTandas(urls, PRECALENTADO_EN_PARALELO, async (u) => {
          try {
            const res = await fetch(u, { credentials: "same-origin" });
            if (res.status === 404 || res.status === 410) {
              await soltarDeVersionesViejas(u);
              return;
            }
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
        });
      } finally {
        if (renueva) renovandoVersionVieja = false;
      }
      await limpiarVersionesViejas();
    })()
  );
});
