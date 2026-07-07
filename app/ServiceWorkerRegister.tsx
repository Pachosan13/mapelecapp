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

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registro fallido (p. ej. modo privado): la app sigue funcionando online.
      });
    };

    // Si el 'load' YA ocurrió antes de montar este efecto, el listener nunca
    // dispararía → registrar de una. Si no, esperar al load para no competir
    // con la carga inicial.
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
