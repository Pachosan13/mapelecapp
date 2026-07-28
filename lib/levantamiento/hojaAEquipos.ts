// Traduce una hoja de mantenimiento de SEMCO (leída de un escaneo) a filas de
// `equipment`.
//
// La hoja de papel tiene cupos fijos por sección (2 principales, 3 reforzadoras,
// 3 sumergibles) y el técnico llena solo las columnas de los equipos que existen:
// una columna con datos escritos = un equipo real. Eso es todo lo que hace la
// lectura; aquí se convierte en inventario.
//
// Los nombres siguen la convención que SEMCO ya usa en los edificios cargados a
// mano ("Bomba Principal #1", "Panel de Control de Bombas Reforzadoras"), no una
// nueva — William lee estas listas todos los días.

import type { Json } from "@/lib/database.types";
import { equipmentTypeFor } from "../equipment/specs.ts";

export type BombaLeida = {
  indice: number;
  presente: boolean;
  etiqueta?: string | null;
};

export type HojaLeida = {
  numero_reporte?: string | null;
  cliente?: string | null;
  fecha?: string | null;
  tecnico_encargado?: string | null;
  confianza?: string | null;
  bombas_principales?: BombaLeida[];
  bombas_reforzadoras?: BombaLeida[];
  bombas_sumergibles?: BombaLeida[];
  contra_incendios?: { bomba_principal?: boolean; bomba_jockey?: boolean };
  planta_electrica?: { presente?: boolean };
  tableros_control?: { sistema: string; presente: boolean }[];
};

export type EquipoNuevo = {
  building_id: string;
  name: string;
  system: string | null;
  kind: string;
  equipment_type: string;
  is_active: boolean;
  sort_order: number;
  notes: string;
  specs: Json;
};

const TABLERO_POR_SISTEMA: Record<string, [string | null, string]> = {
  principales: ["transferencia_agua_potable", "Panel de Control de Bombas Principales"],
  reforzadoras: ["reforzador_agua_potable", "Panel de Control de Bombas Reforzadoras"],
  sumergibles: [null, "Panel de Control de Bombas Sumergibles"],
};

const NOTA_SUMERGIBLE =
  "Sistema SIN IDENTIFICAR: la hoja no dice si es pluvial, sanitario, freático o de foso de elevador. Confirmar.";

export function hojaAEquipos(hoja: HojaLeida, buildingId: string): EquipoNuevo[] {
  const origen = {
    hoja: hoja.numero_reporte ?? null,
    fecha_hoja: hoja.fecha ?? null,
    tecnico: hoja.tecnico_encargado ?? null,
    confianza: hoja.confianza ?? null,
  };
  const base =
    `Cargado desde la hoja de mantenimiento Nº${origen.hoja ?? "?"} ` +
    `(${origen.fecha_hoja ?? "sin fecha"}, ${origen.tecnico ?? "sin técnico"}). ` +
    `SIN VERIFICAR por SEMCO.`;

  const out: EquipoNuevo[] = [];
  const add = (name: string, system: string | null, kind: string, extra = "") => {
    out.push({
      building_id: buildingId,
      name,
      system,
      kind,
      // `equipment_type` es NOT NULL y se deriva del sistema; sin sistema, `pump`.
      equipment_type: equipmentTypeFor(system ?? ""),
      is_active: true,
      sort_order: out.length + 1,
      notes: extra ? `${base} ${extra}` : base,
      specs: { origen, verificado: false },
    });
  };

  const presentes = (bombas?: BombaLeida[]) => (bombas ?? []).filter((b) => b.presente);

  for (const b of presentes(hoja.bombas_principales)) {
    add(`Bomba Principal #${b.indice}`, "transferencia_agua_potable", "bomba");
  }
  for (const b of presentes(hoja.bombas_reforzadoras)) {
    add(`Bomba Reforzadora #${b.indice}`, "reforzador_agua_potable", "bomba");
  }
  for (const b of presentes(hoja.bombas_sumergibles)) {
    const nota = b.etiqueta
      ? `La hoja la rotula "${b.etiqueta}". Confirmar a qué sistema pertenece.`
      : NOTA_SUMERGIBLE;
    add(`Bomba sumergible #${b.indice}`, null, "bomba", nota);
  }

  // REGLA DE WILLIAM (28-jul-2026, textual): "al detectar datos en la bomba
  // jockey automáticamente se convierte en normada". La hoja no dice si el
  // sistema es normado; la columna de la jockey llena lo delata. Y toda normada
  // trae su panel de bomba principal y su panel de jockey, aunque el bloque de
  // TABLERO DE CONTROL de la hoja venga vacío — por eso los paneles de incendio
  // salen de esta regla y no de `tableros_control`.
  const ci = hoja.contra_incendios ?? {};
  const normada = Boolean(ci.bomba_jockey);
  const notaCi = normada
    ? "Sistema NORMADO: la columna de la jockey trae datos (regla de William 28-jul)."
    : "Sin datos en la columna de la jockey → se carga como NO NORMADA (regla de William 28-jul). Confirmar.";

  if (ci.bomba_principal) {
    add(
      "Bomba Contra Incendios",
      normada ? "contra_incendios" : "contra_incendios_no_normada",
      "bomba",
      notaCi
    );
  }
  if (normada) {
    // La palabra "Jockey" en el nombre es load-bearing: es como
    // lib/bombas/checklistFilter.ts separa hasJockeyPanel de hasBciPanel.
    add("Bomba Jockey", "contra_incendios", "bomba", notaCi);
    add("Panel de Control de Bomba Contra Incendios", "contra_incendios", "panel_control", notaCi);
    add("Panel de Control de Bomba Jockey", "contra_incendios", "panel_control", notaCi);
  }

  if (hoja.planta_electrica?.presente) {
    add("Planta de Emergencia", "planta_diesel", "generador");
  }

  for (const t of hoja.tableros_control ?? []) {
    if (!t.presente || t.sistema === "contra_incendios") continue; // los de incendio los pone la regla
    const par = TABLERO_POR_SISTEMA[t.sistema];
    if (!par) continue;
    const [system, nombre] = par;
    add(nombre, system, "panel_control", system === null ? NOTA_SUMERGIBLE : "");
  }

  return out;
}
