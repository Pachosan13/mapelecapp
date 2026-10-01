// Cuándo se puede cancelar una visita.
//
// Decisión pura, separada de la acción de servidor para probarla sin base de datos.
// Una visita se cancela solo si NADIE ha trabajado en ella: planeada, o iniciada pero sin una
// sola respuesta ni foto. Si el técnico ya dejó datos, cancelarla los dejaría huérfanos
// (y el informe saldría a medias), así que se rechaza y se explica por qué.

export type DecisionCancelar = { ok: true } | { ok: false; motivo: string };

export const MOTIVO_MAX = 200;

export function decidirCancelacion(params: {
  status: string | null | undefined;
  respuestas: number;
  fotos: number;
}): DecisionCancelar {
  const { status, respuestas, fotos } = params;

  if (status === "cancelled") {
    return { ok: false, motivo: "Esta visita ya está cancelada." };
  }
  if (status === "completed") {
    return { ok: false, motivo: "Esta visita ya está completada; su informe no se puede cancelar." };
  }
  if (status !== "planned" && status !== "in_progress") {
    return { ok: false, motivo: "Esta visita no se puede cancelar en su estado actual." };
  }
  if (respuestas > 0 || fotos > 0) {
    return {
      ok: false,
      motivo: `El técnico ya cargó datos en esta visita (${respuestas} respuestas, ${fotos} fotos). Cancelarla los dejaría sin visita.`,
    };
  }
  return { ok: true };
}

/** Motivo opcional: sin espacios de más, máximo MOTIVO_MAX caracteres, vacío = sin motivo. */
export function limpiarMotivo(valor: string | null | undefined): string | null {
  const limpio = (valor ?? "").replace(/\s+/g, " ").trim().slice(0, MOTIVO_MAX).trim();
  return limpio === "" ? null : limpio;
}
