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
    target.postMessage({ type: "WARM_PAGES", urls });
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
