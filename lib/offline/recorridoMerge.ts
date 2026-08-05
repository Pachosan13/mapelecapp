/**
 * Fusión del recorrido (tabla de pisos de red húmeda) al hidratar la pantalla.
 *
 * Vive en `lib/` y no dentro del componente porque es la pieza que decide si el
 * técnico conserva o pierde su mañana de trabajo: tiene que ser testeable sola.
 * Ver `recorridoSnapshot.ts` para el porqué del bug (4-ago-2026, PH MATISSE).
 */

export type RecorridoRowDraft = {
  piso: string;
  presion_entrada: string;
  presion_salida: string;
  estacion_control_abierta: boolean;
  estacion_control_cerrada: boolean;
  valvula_reguladora: boolean;
  estado_manometro: boolean;
  gabinetes_manguera: boolean;
  extintores: boolean;
  observacion: string;
};

export const emptyRow = (): RecorridoRowDraft => ({
  piso: "",
  presion_entrada: "",
  presion_salida: "",
  estacion_control_abierta: false,
  estacion_control_cerrada: false,
  valvula_reguladora: false,
  estado_manometro: false,
  gabinetes_manguera: false,
  extintores: false,
  observacion: "",
});

/**
 * ¿Esta fila tiene algo puesto por el técnico? El piso cuenta como dato cuando
 * NO es el correlativo que genera la tabla sola: en PH MATISSE el técnico los
 * numeró al revés (53, 52, 51…) y eso es información suya, no relleno.
 */
export function rowHasData(row: RecorridoRowDraft, index: number): boolean {
  return (
    row.presion_entrada.trim() !== "" ||
    row.presion_salida.trim() !== "" ||
    row.observacion.trim() !== "" ||
    row.estacion_control_abierta ||
    row.estacion_control_cerrada ||
    row.valvula_reguladora ||
    row.estado_manometro ||
    row.gabinetes_manguera ||
    row.extintores ||
    (row.piso.trim() !== "" && row.piso.trim() !== String(index + 1))
  );
}

/**
 * Fusiona fila por fila: gana la LOCAL cuando tiene datos; si no, la del server.
 * Una fila vacía NUNCA tapa una con datos.
 *
 * El sesgo es deliberado: si el técnico borró un piso a propósito y el server
 * todavía lo tiene, reaparece y lo vuelve a borrar en dos segundos. El error al
 * revés le cuesta una mañana de recorrido, que es exactamente lo que pasó.
 */
export function mergeRows(
  server: RecorridoRowDraft[],
  local: RecorridoRowDraft[]
): RecorridoRowDraft[] {
  const total = Math.max(server.length, local.length);
  return Array.from({ length: total }, (_, i) => {
    const filaLocal = local[i];
    const filaServer = server[i];
    if (filaLocal && rowHasData(filaLocal, i)) return filaLocal;
    if (filaServer && rowHasData(filaServer, i)) return filaServer;
    return filaLocal ?? filaServer ?? { ...emptyRow(), piso: String(i + 1) };
  });
}
