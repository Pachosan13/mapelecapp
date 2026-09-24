// Nombre del PDF del informe de servicio.
//
// William, 24-sep-2026: *"el nombre del archivo para cuando envío al cliente no describe
// el proyecto… Informe-servicio-fecha-proyecto (viva plaza) por ejemplo, y si es bombas o
// red"*. Antes salía `informe-servicio-2026-09-24.pdf` para todos los edificios: al mandar
// varios el mismo día, el cliente (y SEMCO) no sabía cuál era cuál.
//
// Solo ASCII: el nombre viaja en la cabecera Content-Disposition, y los acentos o espacios
// ahí se rompen según el navegador o el WhatsApp que lo reciba.

// Tipo corto por plantilla, en el orden en que se prueban (el primero que casa gana).
const TIPOS: Array<[RegExp, string]> = [
  [/bombas/, "bombas"],
  [/red humeda/, "red-humeda"],
  [/presurizacion/, "presurizacion"],
  [/rociadores/, "rociadores"],
  [/recorrido/, "recorrido"],
  [/ipm/, "ipm-bomba"],
];

const sinAcentos = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "");

// "P.H. VIVA PLAZA" → "Viva-Plaza". Se quita el prefijo de propiedad horizontal (P.H.,
// PH., PH): lo tienen casi todos y no distingue nada.
export const slugEdificio = (nombre?: string | null) => {
  const limpio = sinAcentos(String(nombre ?? ""))
    .replace(/^\s*p\s*\.?\s*h\s*\.?\s+/i, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim();
  return limpio
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join("-");
};

export const tipoDePlantilla = (nombre?: string | null) => {
  const n = sinAcentos(String(nombre ?? "")).toLowerCase();
  for (const [re, tipo] of TIPOS) if (re.test(n)) return tipo;
  return null;
};

export const nombreArchivoInforme = (
  fecha: string,
  edificio: string | null | undefined,
  plantillas: Array<string | null | undefined>
) => {
  const tipos = Array.from(
    new Set(plantillas.map(tipoDePlantilla).filter((t): t is string => Boolean(t)))
  );
  const partes = ["Informe-servicio", fecha, slugEdificio(edificio), ...tipos].filter(Boolean);
  return `${partes.join("-")}.pdf`;
};
