// Agrupación de la lista de Facturación. Funciones puras: reciben filas ya leídas y no
// tocan la base de datos.

export type FilaFacturable = {
  /** id de la visita: es lo que recibe /api/reports/service-report?visitId= */
  id: string;
  /** timestamp real de cierre (ISO) */
  completedAt: string;
  /** día de Panamá (YYYY-MM-DD) en que se completó */
  dia: string;
  edificioId: string;
  edificio: string;
  /** nombre del formulario/plantilla: "Mantenimiento – Bombas", "RED HÚMEDA CONTRA INCENDIOS"… */
  formulario: string;
  /** líder o cuadrilla, lo que haya */
  responsable: string | null;
  /** nombre con el que el PDF sale descargado, para cotejarlo con lo que ya se mandó */
  archivo: string;
};

export type GrupoDia = { dia: string; filas: FilaFacturable[] };

const comparar = (a: string, b: string) =>
  a.localeCompare(b, "es", { sensitivity: "base", numeric: true });

/**
 * Un grupo por día, del más reciente al más viejo. Dentro de cada día las filas van por
 * edificio y formulario: es el orden en que contabilidad cruza contra sus facturas, y hace
 * que los dos PDF de un mismo mantenimiento (bombas + red húmeda) queden juntos.
 */
export function agruparPorDia(filas: FilaFacturable[]): GrupoDia[] {
  const porDia = new Map<string, FilaFacturable[]>();
  for (const fila of filas) {
    if (!porDia.has(fila.dia)) porDia.set(fila.dia, []);
    porDia.get(fila.dia)!.push(fila);
  }
  return Array.from(porDia.entries())
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([dia, grupo]) => ({
      dia,
      filas: [...grupo].sort(
        (x, y) =>
          comparar(x.edificio, y.edificio) ||
          comparar(x.formulario, y.formulario) ||
          (x.completedAt < y.completedAt ? -1 : 1)
      ),
    }));
}

export function resumen(filas: FilaFacturable[]): { informes: number; edificios: number } {
  return {
    informes: filas.length,
    edificios: new Set(filas.map((f) => f.edificioId)).size,
  };
}

/** Edificios que sí tienen informes en el rango, sin repetir y en orden alfabético. */
export function opcionesEdificio(
  filas: FilaFacturable[]
): Array<{ id: string; nombre: string }> {
  const vistos = new Map<string, string>();
  for (const f of filas) if (!vistos.has(f.edificioId)) vistos.set(f.edificioId, f.edificio);
  return Array.from(vistos.entries())
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => comparar(a.nombre, b.nombre));
}

export function filtrarEdificio(
  filas: FilaFacturable[],
  edificioId: string | null | undefined
): FilaFacturable[] {
  if (!edificioId) return filas;
  return filas.filter((f) => f.edificioId === edificioId);
}
