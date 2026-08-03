"use client";

import { useState } from "react";
import { pendingCount } from "@/lib/offline/outbox";

type Props = {
  visitId: string;
  enforceChecklistValidation: boolean;
  requiredChecklistItemIds: string[];
  isCompleted: boolean;
};

// Resaltado rojo para los ítems que faltan por marcar.
const MISSING_OUTLINE = "2px solid #ef4444";

export default function CompleteVisitButton({
  visitId,
  enforceChecklistValidation,
  requiredChecklistItemIds,
  isCompleted,
}: Props) {
  const [uiError, setUiError] = useState<string | null>(null);

  // Limpia el resaltado de un intento anterior.
  const clearHighlights = () => {
    document
      .querySelectorAll<HTMLElement>("[data-missing='1']")
      .forEach((el) => {
        el.style.outline = "";
        el.style.outlineOffset = "";
        el.removeAttribute("data-missing");
      });
  };

  // Abre TODAS las secciones plegables (<details>) que esconden el ítem.
  // Sin esto, un ítem sin marcar dentro de una sección colapsada queda
  // invisible y el técnico no sabe qué le falta.
  const openAncestorSections = (el: HTMLElement | null) => {
    let node: HTMLElement | null = el;
    while (node) {
      if (node.tagName === "DETAILS") {
        (node as HTMLDetailsElement).open = true;
      }
      node = node.parentElement;
    }
  };

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    if (isCompleted) return;

    // Frena el cierre si quedan respuestas guardadas SOLO en el equipo.
    // Completar apagaba el autosave y esas respuestas se quedaban varadas para
    // siempre — el técnico las veía desaparecer ("se borran las cosas que uno
    // apunta"). Mejor no dejar cerrar y decir por qué. (3-ago-2026)
    const sinSubir = pendingCount(visitId);
    if (sinSubir > 0) {
      event.preventDefault();
      clearHighlights();
      const sinSenal =
        typeof navigator !== "undefined" && navigator.onLine === false;
      setUiError(
        sinSenal
          ? `Tienes ${sinSubir} ${sinSubir === 1 ? "respuesta guardada" : "respuestas guardadas"} en el equipo que todavía no ${sinSubir === 1 ? "sube" : "suben"}. Busca señal un momento y vuelve a darle a Completar — no se te va a perder nada, está todo guardado en el celular.`
          : `Estoy subiendo ${sinSubir} ${sinSubir === 1 ? "respuesta" : "respuestas"} que faltaban. Espera unos segundos y vuelve a darle a Completar.`
      );
      return;
    }

    if (!enforceChecklistValidation) {
      return;
    }

    const button = event.currentTarget;
    const form = button.form;
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const missingIds = requiredChecklistItemIds.filter((itemId) => {
      const value = formData.get(`item-${itemId}`);
      return value !== "approved" && value !== "failed" && value !== "na";
    });

    if (missingIds.length === 0) {
      clearHighlights();
      setUiError(null);
      return; // todo marcado → deja que el form se envíe
    }

    event.preventDefault();
    clearHighlights();

    let firstRow: HTMLElement | null = null;
    for (const id of missingIds) {
      const input = document.getElementById(`item-${id}`);
      // Abre las secciones plegables que esconden este ítem sin marcar.
      openAncestorSections(input);
      const row =
        (document.getElementById(`item-row-${id}`) as HTMLElement | null) ??
        (input?.closest<HTMLElement>("[data-item-row]") ?? null) ??
        input;
      if (row) {
        row.style.outline = MISSING_OUTLINE;
        row.style.outlineOffset = "2px";
        row.setAttribute("data-missing", "1");
        if (!firstRow) firstRow = row;
      }
    }

    setUiError(
      missingIds.length === 1
        ? "Falta 1 ítem por marcar (Aprobado, Falla o N/A). Te llevé a él — está resaltado en rojo."
        : `Faltan ${missingIds.length} ítems por marcar (Aprobado, Falla o N/A). Te llevé al primero — todos los que faltan están resaltados en rojo.`
    );

    if (firstRow) {
      try {
        firstRow.scrollIntoView({ behavior: "smooth", block: "center" });
        const focusable = firstRow.querySelector<HTMLInputElement>(
          "input[type='radio']"
        );
        focusable?.focus({ preventScroll: true });
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="submit"
        name="action"
        value="complete"
        className="rounded bg-black px-4 py-2 text-white"
        disabled={isCompleted}
        onClick={handleClick}
      >
        Completar visita
      </button>
      {uiError ? (
        <p className="text-sm text-red-600">{uiError}</p>
      ) : null}
    </div>
  );
}
