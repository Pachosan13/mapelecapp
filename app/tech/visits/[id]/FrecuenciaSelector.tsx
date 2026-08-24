"use client";

import { useEffect, useRef, useState } from "react";
import {
  indiceFrecuencia,
  parseFrecuencia,
  type Frecuencia,
} from "@/lib/fire/frecuencia";

type Props = {
  /** name del input = `item-<id>` del ítem "Tipo de inspección". */
  fieldName: string;
  fieldId: string;
  /** Frecuencias que existen en ESTE formato, en orden de periodicidad. */
  frecuencias: Frecuencia[];
  seleccionada: Frecuencia | null;
  /**
   * Lo que había guardado si NO es una periodicidad reconocida (las visitas viejas
   * traen "Nfpa25", "Visual", "Recorrido raicers"). Se ofrece como opción para no
   * borrarle el dato al técnico: si no estuviera en la lista, el select lo dejaría
   * en blanco y el guardado lo pisaría con vacío.
   */
  valorLibre?: string | null;
  disabled: boolean;
};

/**
 * Selector de periodicidad del formato NFPA 25 de rociadores.
 *
 * Feedback William (24-ago-2026): el formato trae 76 ítems repartidos en Mensual,
 * Trimestral, Semestral, Anual y Cada 5 años. En la inspección mensual —"generalmente
 * solo usamos el mensual"— los técnicos tenían que marcar N/A 60 veces, y las visitas
 * se quedaban sin cerrar (completar exige marcar TODO), así que nunca generaban informe.
 *
 * Al elegir la periodicidad se esconden los bloques que no tocan. Es un cambio de DOM,
 * sin recargar: en un sótano no hay señal para pedir otra página. El guardado en el
 * servidor vuelve a aplicar el mismo filtro, así que los bloques escondidos ni se
 * validan ni se guardan — y el informe del cliente deja de salir con filas en "—".
 *
 * NFPA 25 es acumulativo: la trimestral incluye la mensual, la anual incluye todo lo
 * de abajo.
 *
 * ⚠️ El <select> va NO CONTROLADO a propósito, como el resto de los campos de esta
 * pantalla: al montar, `AutosaveManager` repinta el formulario con lo que este equipo
 * respondió sin señal escribiendo `el.value` directo. Un input controlado por React
 * pisaría ese repintado y el técnico vería el formato completo otra vez.
 */
export default function FrecuenciaSelector({
  fieldName,
  fieldId,
  frecuencias,
  seleccionada,
  valorLibre,
  disabled,
}: Props) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const [visibles, setVisibles] = useState<number | null>(null);

  useEffect(() => {
    const select = selectRef.current;
    const form = select?.form;
    if (!select || !form) return;

    const aplicar = () => {
      const elegida = parseFrecuencia(select.value);
      const bloques = Array.from(
        form.querySelectorAll<HTMLDetailsElement>("details[data-frecuencia]")
      );

      for (const bloque of bloques) {
        const propia = parseFrecuencia(bloque.dataset.frecuencia ?? "");
        // Sin periodicidad elegida no se esconde nada: el formato completo de siempre.
        const aplica =
          elegida === null ||
          propia === null ||
          indiceFrecuencia(propia) <= indiceFrecuencia(elegida);
        bloque.hidden = !aplica;
        // Un bloque que se esconde se colapsa: al volver a mostrarlo no aparece
        // desplegado de golpe en medio del formulario.
        if (!aplica) bloque.open = false;
      }

      // Cuántos ítems quedan de verdad por llenar. Responde "¿esto se acortó?" sin que
      // el técnico tenga que bajar hasta el final del formulario.
      const total = form.querySelectorAll("[data-item-row]").length;
      const ocultos = bloques
        .filter((bloque) => bloque.hidden)
        .reduce(
          (n, bloque) => n + bloque.querySelectorAll("[data-item-row]").length,
          0
        );
      setVisibles(total - ocultos);
    };

    // Al montar corre una vez: el repintado offline de AutosaveManager ya pasó (su
    // efecto es anterior en el árbol), así que acá se lee el valor REAL del select.
    aplicar();
    select.addEventListener("change", aplicar);
    return () => select.removeEventListener("change", aplicar);
  }, []);

  return (
    <div className="rounded-lg border-2 border-sky-300 bg-sky-50 p-4">
      <label
        htmlFor={fieldId}
        className="mb-1 block text-sm font-semibold text-sky-900"
      >
        Tipo de inspección
      </label>
      <p className="mb-2 text-xs text-sky-800">
        Elige la periodicidad y el formulario se recorta a lo que toca. Es
        acumulativo: la trimestral incluye lo mensual, y la anual incluye todo lo
        anterior.
      </p>
      <select
        ref={selectRef}
        id={fieldId}
        name={fieldName}
        defaultValue={seleccionada ?? valorLibre ?? ""}
        disabled={disabled}
        className="w-full rounded border border-sky-400 bg-white px-3 py-2 text-base font-medium disabled:bg-slate-100"
      >
        <option value="">Formato completo (sin recortar)</option>
        {frecuencias.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
        {valorLibre ? (
          <option value={valorLibre}>{valorLibre} (sin periodicidad)</option>
        ) : null}
      </select>
      {visibles !== null ? (
        <p className="mt-2 text-xs font-medium text-sky-900">
          {visibles} ítem{visibles === 1 ? "" : "s"} por llenar.
        </p>
      ) : null}
    </div>
  );
}
