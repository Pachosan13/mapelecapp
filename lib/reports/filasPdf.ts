// Agrupado y unidades de las filas del PDF del cliente (William, 25-sep).
// Módulo puro (sin pdf-lib) para poder probarlo con node --test.

export type FilaPdf = {
  label: string;
  value: string;
  kind: "checkbox" | "number" | "text";
};

// "Bombas principales - Bomba 2 - Voltaje L1-L2" → sección "Bomba principal #2",
// fila "Voltaje L1-L2". Antes todas las principales iban en una sola tabla con el
// prefijo "Bomba N - " en cada fila; las demás bombas ya salían una sección por unidad.
const PRINCIPAL = /^Bomba (\d+) - (.+)$/i;

export function agruparFilas(rows: FilaPdf[]): { name: string; rows: FilaPdf[] }[] {
  const groups: { name: string; rows: FilaPdf[] }[] = [];
  for (const r of rows) {
    const idx = r.label.indexOf(" - ");
    let name = idx > 0 ? r.label.slice(0, idx).trim() : "General";
    let cleanLabel = idx > 0 ? r.label.slice(idx + 3).trim() : r.label;
    if (name === "Bombas principales") {
      const m = cleanLabel.match(PRINCIPAL);
      if (m) {
        name = `Bomba principal #${m[1]}`;
        cleanLabel = m[2].trim();
      }
    }
    let g = groups.find((x) => x.name === name);
    if (!g) {
      g = { name, rows: [] };
      groups.push(g);
    }
    g.rows.push({ ...r, label: cleanLabel });
  }
  return groups;
}

// Unidad que va pegada al número: presiones en psi, caudal en gpm.
export function unidadDe(label: string): string | null {
  const l = label.toLowerCase();
  if (/\bgalones por minuto\b|\bgpm\b/.test(l)) return "gpm";
  if (/presi[oó]n|\bpsi\b/.test(l)) return "psi";
  return null;
}

// Solo a valores numéricos: "N/A", "—" o texto libre se dejan como vinieron.
export function valorConUnidad(fila: FilaPdf): string {
  if (fila.kind !== "number") return fila.value;
  const v = (fila.value ?? "").trim();
  if (!/^-?\d+(?:[.,]\d+)?$/.test(v)) return fila.value;
  const unidad = unidadDe(fila.label);
  return unidad ? `${v} ${unidad}` : fila.value;
}
