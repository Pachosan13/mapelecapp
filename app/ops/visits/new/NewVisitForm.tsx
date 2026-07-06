"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCrewLabel } from "@/lib/formatters/crewLabel";

const CATEGORY_LABELS: Record<string, string> = {
  pump: "Bombas",
  fire: "Incendio",
};

type BuildingOption = {
  id: string;
  name: string;
  systems: string[] | null;
};

type TemplateOption = {
  id: string;
  name: string;
  category: string;
};

type CrewOption = {
  id: string;
  name: string;
  leader?: { full_name: string | null };
  helper?: { full_name: string | null };
};

type EquipmentOption = {
  id: string;
  building_id: string;
  name: string;
  equipment_type: string;
  is_active: boolean;
};

type NewVisitFormProps = {
  action: (formData: FormData) => void;
  buildings: BuildingOption[];
  templates: TemplateOption[];
  crews: CrewOption[];
  equipment: EquipmentOption[];
};

export default function NewVisitForm({
  action,
  buildings,
  templates,
  crews,
  equipment,
}: NewVisitFormProps) {
  const [buildingId, setBuildingId] = useState("");
  const onValueChange = (value: string) => setBuildingId(value);

  // Buscador de building (feedback William 6-jul): antes era un <select> y había
  // que bajar hasta encontrarlo. Ahora se escribe para filtrar, como en edificios.
  const [buildingQuery, setBuildingQuery] = useState("");
  const [buildingOpen, setBuildingOpen] = useState(false);

  const filteredBuildings = useMemo(() => {
    const q = buildingQuery.trim().toLowerCase();
    if (!q) return buildings;
    return buildings.filter((building) =>
      building.name.toLowerCase().includes(q)
    );
  }, [buildings, buildingQuery]);

  const pickBuilding = (building: BuildingOption) => {
    onValueChange(building.id);
    setBuildingQuery(building.name);
    setBuildingOpen(false);
  };

  const selectedBuilding = useMemo(
    () => buildings.find((building) => building.id === buildingId) ?? null,
    [buildingId, buildings]
  );

  const systems = selectedBuilding?.systems ?? [];
  const hasSystems = systems.length > 0;
  const filteredTemplates = selectedBuilding
    ? hasSystems
      ? templates.filter((template) => systems.includes(template.category))
      : templates
    : templates;

  const equipmentForBuilding = useMemo(
    () =>
      equipment.filter(
        (item) => item.building_id === buildingId && item.is_active
      ),
    [equipment, buildingId]
  );

  return (
    <form action={action} className="max-w-xl space-y-8">
      {selectedBuilding && !hasSystems ? (
        <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-3 text-sm text-amber-800">
          Este building no tiene sistemas configurados (pump/fire).
        </div>
      ) : null}
      <section className="space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Building
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Building</label>
          <div className="relative">
            <input type="hidden" name="building_id" value={buildingId} />
            <input
              type="text"
              autoComplete="off"
              placeholder="Busca o selecciona un building…"
              value={buildingQuery}
              onChange={(event) => {
                setBuildingQuery(event.target.value);
                setBuildingId("");
                setBuildingOpen(true);
              }}
              onFocus={() => setBuildingOpen(true)}
              onBlur={() => setTimeout(() => setBuildingOpen(false), 120)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-300 focus:outline-none"
            />
            {buildingOpen ? (
              <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg">
                {filteredBuildings.length > 0 ? (
                  filteredBuildings.map((building) => (
                    <li key={building.id}>
                      <button
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          pickBuilding(building);
                        }}
                        className={`block w-full px-3 py-2 text-left hover:bg-gray-100 ${
                          building.id === buildingId ? "bg-gray-50 font-medium" : ""
                        }`}
                      >
                        {building.name}
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="px-3 py-2 text-gray-400">Sin resultados</li>
                )}
              </ul>
            ) : null}
          </div>
        </div>
        {buildingId ? (
          <div>
            <label className="mb-1 block text-sm font-medium">
              Equipos (opcional)
            </label>
            {equipmentForBuilding.length > 0 ? (
              <div className="space-y-2">
                {equipmentForBuilding.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="equipment_ids"
                      value={item.id}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span>{item.name}</span>
                    <span className="text-xs text-gray-400">
                      ({CATEGORY_LABELS[item.equipment_type] ?? item.equipment_type})
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No hay equipos activos para este building.
              </p>
            )}
            <p className="mt-2 text-xs text-gray-400">
              Si no seleccionas equipos, la visita queda a nivel building.
            </p>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Formularios
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Formularios</label>
          {!buildingId ? (
            <p className="text-sm text-gray-500">
              Selecciona un building primero.
            </p>
          ) : filteredTemplates.length > 0 ? (
            <div className="space-y-2">
              {filteredTemplates.map((template) => (
                <label key={template.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="template_ids"
                    value={template.id}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span>{template.name}</span>
                  <span className="text-xs text-gray-400">
                    ({CATEGORY_LABELS[template.category] ?? template.category})
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No hay formularios activos para este building.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Programación
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Fecha</label>
          <input
            type="date"
            name="scheduled_for"
            required
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-300 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Asignar a cuadrilla
          </label>
          <select
            name="assigned_crew_id"
            required
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-300 focus:outline-none"
          >
            <option value="">Selecciona una cuadrilla</option>
            {crews.map((crew) => (
              <option key={crew.id} value={crew.id}>
                {formatCrewLabel(crew)}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          className="rounded-full bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-black"
        >
          Crear visita
        </button>
        <Link
          href="/ops/dashboard"
          className="rounded-full px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
