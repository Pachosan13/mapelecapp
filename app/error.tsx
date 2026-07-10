"use client";

import { useEffect, useState } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Muchos de estos errores en campo son solo falta de señal: una navegación o
  // carga del servidor que falló en el sótano. No es que "algo salió mal" — el
  // trabajo está guardado en el equipo. Detectamos ese caso y damos un mensaje
  // tranquilo que se recupera solo al volver la conexión.
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const check = () =>
      setOffline(
        typeof navigator !== "undefined" && navigator.onLine === false
      );
    check();
    // Al volver la señal, reintentar solo el render que falló.
    const onOnline = () => reset();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", check);
    const t = window.setInterval(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) reset();
    }, 4000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", check);
      window.clearInterval(t);
    };
  }, [reset]);

  if (offline) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center gap-4 px-6 py-10">
        <h1 className="text-2xl font-semibold">Sin conexión</h1>
        <p className="text-sm text-slate-600">
          No hay señal en este punto (sótano/foso). Es normal en estas áreas.
        </p>
        <p className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
          ✓ Tu trabajo está guardado en el equipo
        </p>
        <p className="text-sm text-slate-500">
          La pantalla vuelve sola apenas recuperes señal. No pierdes nada.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Reintentar
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center gap-4 px-6 py-10">
      <h1 className="text-2xl font-semibold">Algo salio mal</h1>
      <p className="text-sm text-slate-600">
        Ocurrio un error inesperado. Puedes intentar nuevamente.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
      >
        Reintentar
      </button>
      <p className="text-xs text-slate-400">
        {error.digest ? `Codigo: ${error.digest}` : "Sin codigo de error."}
      </p>
    </main>
  );
}
