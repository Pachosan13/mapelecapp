"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelVisit } from "./[id]/actions";

/**
 * Cancelar visita en dos pasos (botón → motivo opcional + confirmar). Sin `window.confirm`:
 * el aviso queda en pantalla, junto a lo que se va a cancelar, y se puede probar de punta a punta.
 * `irA`: a dónde ir al terminar (la ficha de la visita ya no tiene sentido); sin eso, solo refresca.
 */
export default function CancelVisitButton({
  visitId,
  irA,
  compacto = false,
}: {
  visitId: string;
  irA?: string;
  compacto?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  const confirmar = () => {
    setError(null);
    startTransition(async () => {
      const resultado = await cancelVisit(visitId, motivo);
      if (resultado?.error) {
        setError(resultado.error);
        return;
      }
      setAbierto(false);
      if (irA) router.push(irA);
      else router.refresh();
    });
  };

  if (!abierto) {
    return (
      <button
        type="button"
        data-testid="cancelar-abrir"
        onClick={() => setAbierto(true)}
        className={
          compacto
            ? "text-xs text-red-600 hover:underline"
            : "rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        }
      >
        Cancelar visita
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/60 p-3 text-sm">
      <p className="text-gray-700">
        La visita deja de contar como pendiente y sale de las listas. Queda en el historial del edificio.
      </p>
      <input
        type="text"
        data-testid="cancelar-motivo"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        maxLength={200}
        placeholder="Motivo (opcional), p. ej. el técnico salió a un correctivo"
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-300 focus:outline-none"
      />
      {error ? (
        <p data-testid="cancelar-error" className="text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="cancelar-confirmar"
          onClick={confirmar}
          disabled={pendiente}
          className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {pendiente ? "Cancelando…" : "Confirmar cancelación"}
        </button>
        <button
          type="button"
          data-testid="cancelar-volver"
          onClick={() => {
            setAbierto(false);
            setError(null);
          }}
          disabled={pendiente}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Volver
        </button>
      </div>
    </div>
  );
}
