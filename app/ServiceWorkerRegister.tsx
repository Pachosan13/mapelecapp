"use client";

import { useEffect } from "react";

/**
 * Registra el service worker (public/sw.js) que da el shell offline.
 *
 * Solo en producción: en dev cachear rompería el HMR de Next. El SW se auto-actualiza
 * cuando cambia el contenido de sw.js (VERSION en los nombres de caché + skipWaiting).
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    // Precalentar en el SW los documentos que el técnico necesitará sin señal:
    // la página actual y /tech/today (el arranque del PWA). Así, si sale del app y
    // vuelve a entrar en un sótano, la navegación cae a la copia cacheada y continúa.
    const warm = async () => {
      try {
        if (!navigator.onLine) return;
        const path = window.location.pathname;
        if (!path.startsWith("/tech") && !path.startsWith("/ops")) return;
        const reg = await navigator.serviceWorker.ready;
        const active = reg.active;
        if (!active) return;
        const urls = [window.location.pathname + window.location.search];
        if (path.startsWith("/tech") && !urls.includes("/tech/today")) {
          urls.push("/tech/today");
        }
        active.postMessage({ type: "WARM_PAGES", urls });
      } catch {
        // best-effort: si falla, la navegación network-first igual cachea al cargar.
      }
    };

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => warm())
        .catch(() => {
          // Registro fallido (p. ej. modo privado): la app sigue funcionando online.
        });
    };

    // Reintentar el precalentado cuando vuelve la señal.
    window.addEventListener("online", warm);

    // Si el 'load' YA ocurrió antes de montar este efecto, el listener nunca
    // dispararía → registrar de una. Si no, esperar al load para no competir
    // con la carga inicial.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
    return () => {
      window.removeEventListener("load", register);
      window.removeEventListener("online", warm);
    };
  }, []);

  return null;
}
