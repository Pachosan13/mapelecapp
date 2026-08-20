const MESES_CORTOS = [
  "ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic",
];

/**
 * Fecha corta en español ("13-jul-2026"). formatDateOnlyLabel devuelve MM/DD/YYYY,
 * que a un técnico en Panamá se le lee al revés. Se agrega aparte en vez de cambiar
 * el existente para no mover de golpe las pantallas que ya lo usan.
 */
export function formatShortDateLabel(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  const mes = MESES_CORTOS[Number(m) - 1];
  if (!y || !mes || !d) return String(dateStr);
  return `${Number(d)}-${mes}-${y}`;
}

export function formatDateOnlyLabel(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return String(dateStr);
  return `${m}/${d}/${y}`;
}

export function shiftDateOnly(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;

  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  const yy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
