// Rango de fechas de la vista de Facturación.
//
// Todo son FECHAS (YYYY-MM-DD) de Panamá, no timestamps: el filtro real contra `completed_at`
// lo arma `getPanamaDayRange`. Este archivo solo decide QUÉ rango se está pidiendo y se
// puede probar sin base de datos ni reloj (recibe `hoy` como parámetro).

export type PresetId = "hoy" | "ayer" | "7d" | "mes" | "mes_pasado";

export const PRESETS: Array<{ id: PresetId; label: string }> = [
  { id: "hoy", label: "Hoy" },
  { id: "ayer", label: "Ayer" },
  { id: "7d", label: "Últimos 7 días" },
  { id: "mes", label: "Este mes" },
  { id: "mes_pasado", label: "Mes pasado" },
];

export const PRESET_POR_DEFECTO: PresetId = "7d";

// Tope del rango: cada fila es un informe y cada informe es un PDF. Un rango de un año
// serían miles de filas en una sola página.
export const MAX_DIAS = 92;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const aUtc = (fecha: string) => {
  const [y, m, d] = fecha.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

const deUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Fecha real (rechaza "2026-02-31"), no solo con la forma correcta. */
export function esFechaValida(valor: string | null | undefined): valor is string {
  if (!valor || !FECHA.test(valor)) return false;
  return deUtc(aUtc(valor)) === valor;
}

export function sumarDias(fecha: string, dias: number): string {
  return deUtc(aUtc(fecha) + dias * 86_400_000);
}

/** Días del rango, contando ambos extremos. */
export function diasDelRango(desde: string, hasta: string): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / 86_400_000) + 1;
}

const primerDiaDelMes = (fecha: string) => `${fecha.slice(0, 7)}-01`;

export function rangoPorPreset(
  preset: PresetId,
  hoy: string
): { desde: string; hasta: string } {
  switch (preset) {
    case "hoy":
      return { desde: hoy, hasta: hoy };
    case "ayer": {
      const ayer = sumarDias(hoy, -1);
      return { desde: ayer, hasta: ayer };
    }
    case "7d":
      return { desde: sumarDias(hoy, -6), hasta: hoy };
    case "mes":
      return { desde: primerDiaDelMes(hoy), hasta: hoy };
    case "mes_pasado": {
      const inicioEste = primerDiaDelMes(hoy);
      const ultimoDelPasado = sumarDias(inicioEste, -1);
      return { desde: primerDiaDelMes(ultimoDelPasado), hasta: ultimoDelPasado };
    }
  }
}

export type RangoResuelto = {
  desde: string;
  hasta: string;
  /** Preset activo, o null si el rango es personalizado. */
  preset: PresetId | null;
  /** Mensaje para mostrar cuando se corrigió algo del pedido. */
  aviso: string | null;
};

const esPreset = (v: string | undefined): v is PresetId =>
  PRESETS.some((p) => p.id === v);

/**
 * Convierte lo que venga en la URL en un rango seguro.
 * - `desde` y `hasta` válidos mandan sobre el preset.
 * - Si vienen al revés se voltean, y `hasta` nunca pasa de hoy.
 * - Más de MAX_DIAS se recorta conservando `hasta`, y se avisa.
 * - Cualquier otra cosa cae al preset por defecto, sin error.
 */
export function resolverRango(
  params: { preset?: string; desde?: string; hasta?: string },
  hoy: string
): RangoResuelto {
  if (esFechaValida(params.desde) && esFechaValida(params.hasta)) {
    let desde = params.desde;
    let hasta = params.hasta;
    if (desde > hasta) [desde, hasta] = [hasta, desde];
    if (hasta > hoy) hasta = hoy;
    if (desde > hasta) desde = hasta;
    let aviso: string | null = null;
    if (diasDelRango(desde, hasta) > MAX_DIAS) {
      desde = sumarDias(hasta, -(MAX_DIAS - 1));
      aviso = `El rango máximo es de ${MAX_DIAS} días: se muestran los últimos ${MAX_DIAS} hasta la fecha final.`;
    }
    const coincide = PRESETS.find((p) => {
      const r = rangoPorPreset(p.id, hoy);
      return r.desde === desde && r.hasta === hasta;
    });
    return { desde, hasta, preset: coincide?.id ?? null, aviso };
  }

  const preset = esPreset(params.preset) ? params.preset : PRESET_POR_DEFECTO;
  return { ...rangoPorPreset(preset, hoy), preset, aviso: null };
}
