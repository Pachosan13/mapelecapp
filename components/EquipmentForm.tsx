"use client";

import Link from "next/link";
import { useState } from "react";

const SYSTEMS: [string, string][] = [
  ["transferencia_agua_potable", "Transferencia agua potable"],
  ["reforzador_agua_potable", "Reforzador agua potable"],
  ["contra_incendios", "Contra incendios (NFPA)"],
  ["contra_incendios_no_normada", "Contra incendios (no normada)"],
  ["achique_freatico", "Achique freático"],
  ["achique_elevador", "Achique elevador"],
  ["achique_pluvial", "Achique pluvial"],
  ["sanitario", "Sanitario"],
  ["planta_diesel", "Planta diésel"],
];

const KINDS: [string, string][] = [
  ["bomba", "Bomba"],
  ["panel_control", "Panel de control"],
  ["generador", "Generador"],
];

const STARTERS: [string, string][] = [
  ["arrancador_suave", "Arrancador suave"],
  ["variador_frecuencia", "Variador de frecuencia"],
  ["contactor_termica", "Contactor + térmica"],
  ["presion_constante", "Presión constante"],
  ["hidroneumatico", "Hidroneumático"],
];

const inputCls = "w-full rounded border px-3 py-2";

function NumField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        type="number"
        step="any"
        name={name}
        defaultValue={defaultValue}
        className={inputCls}
      />
    </div>
  );
}

export type EquipmentFormDefaults = {
  name: string;
  system: string;
  kind: string;
  manufacturer: string;
  model: string;
  serial: string;
  location: string;
  tag: string;
  notes: string;
  isActive: boolean;
  specs: Record<string, unknown>;
};

export default function EquipmentForm({
  buildingId,
  equipmentId,
  action,
  error,
  cancelHref,
  doneHref,
  saved,
  defaults,
  submitLabel = "Guardar equipo",
}: {
  buildingId: string;
  /** Solo en edición: el server action lo lee para saber qué fila actualizar. */
  equipmentId?: string;
  action: (formData: FormData) => void;
  error?: string;
  cancelHref: string;
  doneHref?: string;
  saved?: boolean;
  defaults?: EquipmentFormDefaults;
  submitLabel?: string;
}) {
  // Equipos creados antes de la migración system/kind traen kind vacío: caen a "bomba".
  const [kind, setKind] = useState(defaults?.kind || "bomba");

  const spec = (k: string): string | undefined => {
    const v = defaults?.specs?.[k];
    return v == null ? undefined : String(v);
  };

  return (
    <form action={action} className="max-w-xl space-y-4">
      <input type="hidden" name="building_id" value={buildingId} />
      {equipmentId ? <input type="hidden" name="id" value={equipmentId} /> : null}

      {saved ? (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          ✅ Equipo agregado. Llena el siguiente, o toca &quot;Listo&quot; para volver.
        </div>
      ) : null}

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium">Nombre del equipo</label>
        <input
          type="text"
          name="name"
          required
          defaultValue={defaults?.name}
          placeholder="Ej: Bomba principal #1"
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Sistema</label>
        <select
          name="system"
          required
          defaultValue={defaults?.system ?? ""}
          className={inputCls}
        >
          <option value="">Selecciona el sistema</option>
          {SYSTEMS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Tipo de equipo</label>
        <select
          name="kind"
          required
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className={inputCls}
        >
          {KINDS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Fabricante</label>
        <input
          type="text"
          name="manufacturer"
          defaultValue={defaults?.manufacturer}
          placeholder="Ej: LEO, SPP, FIRETROL"
          className={inputCls}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Modelo</label>
        <input
          type="text"
          name="model"
          defaultValue={defaults?.model}
          placeholder="Ej: LVS 45-6-2"
          className={inputCls}
        />
      </div>

      {/* Datos de placa — cambian según el tipo de equipo */}
      <fieldset className="rounded border bg-gray-50 p-3">
        <legend className="px-1 text-xs font-semibold uppercase text-gray-500">Datos de placa</legend>
        {kind === "bomba" && (
          <div className="grid grid-cols-2 gap-3" key={kind}>
            <NumField label="Potencia (HP)" name="hp" defaultValue={spec("hp")} />
            <NumField label="Voltaje (V)" name="voltage" defaultValue={spec("voltage")} />
            <NumField label="Presión (PSI)" name="pressure_psi" defaultValue={spec("pressure_psi")} />
            <NumField label="Caudal (GPM)" name="flow_gpm" defaultValue={spec("flow_gpm")} />
          </div>
        )}
        {kind === "panel_control" && (
          <div className="grid grid-cols-2 gap-3" key={kind}>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium">Tipo de arranque</label>
              <select
                name="starter_type"
                defaultValue={spec("starter_type") ?? ""}
                className={inputCls}
              >
                <option value="">Selecciona…</option>
                {STARTERS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <NumField label="Potencia" name="power" defaultValue={spec("power")} />
            <NumField label="Voltaje (V)" name="voltage" defaultValue={spec("voltage")} />
          </div>
        )}
        {kind === "generador" && (
          <div className="grid grid-cols-2 gap-3" key={kind}>
            <NumField label="Potencia (KVA)" name="kva" defaultValue={spec("kva")} />
            <NumField label="Potencia real (KW)" name="kw" defaultValue={spec("kw")} />
            <NumField label="Corriente (A)" name="current_a" defaultValue={spec("current_a")} />
            <NumField label="Voltaje (V)" name="voltage" defaultValue={spec("voltage")} />
          </div>
        )}
      </fieldset>

      <div>
        <label className="mb-1 block text-sm font-medium">Serial</label>
        <input
          type="text"
          name="serial"
          defaultValue={defaults?.serial}
          className={inputCls}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Ubicación</label>
        <input
          type="text"
          name="location"
          defaultValue={defaults?.location}
          placeholder="Ej: Sótano 2, cuarto de bombas"
          className={inputCls}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Etiqueta</label>
        <input
          type="text"
          name="tag"
          defaultValue={defaults?.tag}
          className={inputCls}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Notas</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaults?.notes}
          className={inputCls}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={defaults ? defaults.isActive : true}
        />
        <span>Activo</span>
      </label>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
          {submitLabel}
        </button>
        {doneHref ? (
          <Link href={doneHref} className="rounded bg-slate-600 px-4 py-2 text-white">
            Listo
          </Link>
        ) : null}
        <Link href={cancelHref} className="rounded border px-4 py-2 text-gray-700">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
