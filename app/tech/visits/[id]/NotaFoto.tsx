"use client";

import { useState } from "react";

type Props = {
  mediaId: string;
  inicial: string;
  disabled: boolean;
  guardar: (mediaId: string, nota: string) => Promise<{ ok: boolean; error?: string }>;
};

/**
 * Nota interna que el técnico le pone a una foto ya subida.
 *
 * Pedido de un técnico vía William (24-ago-2026): "que a las fotos se le pueda poner
 * comentarios". Va sobre la foto YA SUBIDA y no sobre la que está en la cola, porque
 * ese es el momento en que el técnico la ve y puede describirla: dispara cuatro fotos
 * seguidas del cuarto de bombas y después dice cuál era la fuga.
 *
 * NO va al informe del cliente. La lee el gerente y nadie más — mismo trato que el
 * campo "Observaciones del técnico (interno)" que ya existe al final del formulario.
 * El pie de foto que sí se imprime en el PDF es otro campo y lo escribe el gerente.
 */
export default function NotaFoto({ mediaId, inicial, disabled, guardar }: Props) {
  const [nota, setNota] = useState(inicial);
  const [guardada, setGuardada] = useState(inicial);
  const [estado, setEstado] = useState<"idle" | "guardando" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const sucia = nota.trim() !== guardada.trim();

  const onGuardar = async () => {
    setEstado("guardando");
    setError(null);
    // Sin señal no vale fingir que guardó: la nota se escribe contra la base, no hay
    // cola para esto. Se le dice y el texto se le queda en pantalla para reintentar.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setEstado("error");
      setError("Sin señal. Tu nota sigue escrita acá; dale de nuevo cuando tengas.");
      return;
    }
    const r = await guardar(mediaId, nota).catch(() => ({
      ok: false as const,
      error: "No se pudo guardar.",
    }));
    if (r.ok) {
      setGuardada(nota);
      setEstado("ok");
    } else {
      setEstado("error");
      setError(r.error ?? "No se pudo guardar.");
    }
  };

  return (
    <div className="mt-2 w-full">
      <label className="mb-1 block text-xs font-medium text-gray-600">
        Nota para el gerente{" "}
        <span className="font-normal text-gray-400">(no sale en el informe)</span>
      </label>
      <div className="flex flex-wrap items-start gap-2">
        <textarea
          value={nota}
          disabled={disabled}
          rows={2}
          maxLength={500}
          placeholder="Ej: esta es la fuga del sello de la bomba 2"
          onChange={(e) => {
            setNota(e.target.value);
            setEstado("idle");
            setError(null);
          }}
          className="min-w-0 flex-1 rounded border px-2 py-1 text-sm disabled:bg-gray-100"
        />
        <button
          type="button"
          onClick={() => void onGuardar()}
          disabled={disabled || !sucia || estado === "guardando"}
          className="rounded border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
        >
          {estado === "guardando" ? "Guardando…" : "Guardar nota"}
        </button>
      </div>
      {estado === "ok" && !sucia ? (
        <p className="mt-1 text-xs font-medium text-green-700">Nota guardada.</p>
      ) : null}
      {estado === "error" && error ? (
        <p className="mt-1 text-xs font-medium text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
