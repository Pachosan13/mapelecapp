// Día de Panamá (YYYY-MM-DD) de un timestamp.
//
// ⚠️ Una fecha SIN hora ("2026-09-24", como `visits.scheduled_for`) ya ES un día: no se
// convierte. `new Date("2026-09-24")` la lee como medianoche UTC, y en Panamá (UTC-5) eso
// es el 23 a las 7 pm — el informe de una visita NO completada salía con el día anterior,
// en la fecha del informe y en el nombre del PDF (visto en la E2E del 24-sep-2026).
// Las completadas usan `completed_at` (timestamp real) y siempre salieron bien.
export const PANAMA_TIME_ZONE = "America/Panama";

export const panamaDateOf = (iso: string): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso.trim())) return iso.trim();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PANAMA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
};
