"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Registra el service worker (public/sw.js) que da el shell offline y precalienta en
 * caché los documentos que el técnico/gerente pueda necesitar sin señal.
 *
 * Solo en producción: en dev cachear rompería el HMR de Next.
 *
 * Se registra como `/sw.js?v=<buildId>`: al cambiar la URL en cada deploy, el navegador
 * baja el worker de nuevo, y el propio sw.js toma esa `v` como nombre de sus cachés
 * (skipWaiting + clients.claim + borrado de los cachés que no son de esta versión).
 * Así una página cacheada nunca sobrevive al deploy que la dejó obsoleta — que es lo que
 * dejó a las tablets en blanco el 20-jul, cuando la versión se subía a mano y se olvidó.
 */

// Cuántas visitas de la lista se precalientan como máximo. Son documentos completos:
// suficientes para cubrir la jornada, sin vaciarle los datos al técnico.
const MAX_VISITAS_A_PRECALENTAR = 12;
// No repetir el precalentado de una misma URL antes de esto. warmCurrentPage corre en
// cada visibilitychange/pagehide (cada vez que sale a WhatsApp y vuelve), y sin freno
// serían 12 documentos por cada salida.
// Dos ventanas distintas a propósito: la página actual pesa poco y conviene fresca; la
// tanda de visitas de la lista son ~250 KB cada una (medido: 12 = 3 MB) y el técnico
// anda con datos móviles, así que se re-baja mucho menos seguido. Su trabajo no se
// pierde por eso: lo que escribe vive en la cola local, no en el HTML cacheado.
const MS_ENTRE_PRECALENTADOS = 5 * 60 * 1000;
const MS_ENTRE_PRECALENTADOS_LISTA = 30 * 60 * 1000;
const ultimoPrecalentado = new Map<string, number>();

// Le pide al service worker que guarde en caché el documento de la página actual.
// Corre en cada visita CON señal, así queda disponible aunque después pierdan señal
// y Chrome recargue la pestaña (p. ej. al volver de WhatsApp).
function warmCurrentPage() {
  try {
    if (typeof navigator === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (!navigator.onLine) return;
    const path = window.location.pathname;
    if (!path.startsWith("/tech") && !path.startsWith("/ops")) return;
    // El worker con el handler WARM_PAGES es el que controla la página.
    const target = navigator.serviceWorker.controller;
    if (!target) return;
    const urls = [window.location.pathname + window.location.search];
    if (path.startsWith("/tech") && !urls.includes("/tech/today")) {
      urls.push("/tech/today");
    }

    // Desde la lista de Hoy, precalentar TAMBIÉN el documento de cada visita listada.
    // Sin esto el técnico llega al sótano con /tech/today en caché pero ninguna visita:
    // toca una y se come la pantalla de "sin conexión". Verificado en producción el
    // 20-ago (el caché traía solo ["/tech/today"]). Pesa más ahora que la lista incluye
    // las visitas que quedaron abiertas de días anteriores.
    if (path === "/tech/today") {
      const enlaces = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href^="/tech/visits/"]')
      )
        .map((a) => a.getAttribute("href"))
        .filter((href): href is string => Boolean(href));
      for (const href of enlaces) {
        if (urls.length >= MAX_VISITAS_A_PRECALENTAR + 2) break;
        if (!urls.includes(href)) urls.push(href);
      }
    }

    const ahora = Date.now();
    const base = new Set([
      window.location.pathname + window.location.search,
      "/tech/today",
    ]);
    const pendientes = urls.filter((u) => {
      const ventana = base.has(u)
        ? MS_ENTRE_PRECALENTADOS
        : MS_ENTRE_PRECALENTADOS_LISTA;
      return ahora - (ultimoPrecalentado.get(u) ?? 0) > ventana;
    });
    if (pendientes.length === 0) return;
    pendientes.forEach((u) => ultimoPrecalentado.set(u, ahora));

    target.postMessage({ type: "WARM_PAGES", urls: pendientes });
  } catch {
    // best-effort: si falla, la navegación network-first igual cachea al cargar.
  }
}

export default function ServiceWorkerRegister() {
  const pathname = usePathname();

  // Registro del SW + listeners de ciclo de vida (una sola vez).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    // Sin buildId (build local viejo) cae a "dev": el SW igual funciona, solo que su
    // caché no rota hasta el próximo build con id.
    const buildId = process.env.NEXT_PUBLIC_BUILD_ID || "dev";

    const register = () => {
      navigator.serviceWorker
        .register(`/sw.js?v=${encodeURIComponent(buildId)}`)
        .then(() => navigator.serviceWorker.ready)
        .then(() => warmCurrentPage())
        .catch(() => {
          // Registro fallido (p. ej. modo privado): la app sigue funcionando online.
        });
    };

    const onVisibility = () => warmCurrentPage();
    window.addEventListener("online", warmCurrentPage);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", warmCurrentPage);
    navigator.serviceWorker.addEventListener("controllerchange", warmCurrentPage);

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
    return () => {
      window.removeEventListener("load", register);
      window.removeEventListener("online", warmCurrentPage);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", warmCurrentPage);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        warmCurrentPage
      );
    };
  }, []);

  // Cachear CADA página que visitan con señal (incluye navegaciones internas de Next),
  // no solo la de arranque. Este es el punto que faltaba: /ops/* se llega por <Link>
  // (navegación interna) y antes nunca se cacheaba como documento.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    warmCurrentPage();
  }, [pathname]);

  return null;
}
