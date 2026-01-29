"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

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

type TechOption = {
  user_id: string;
  full_name: string | null;
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
  techs: TechOption[];
  equipment: EquipmentOption[];
};

export default function NewVisitForm({
  action,
  buildings,
  templates,
  techs,
  equipment,
}: NewVisitFormProps) {
  const [buildingId, setBuildingId] = useState("");
  const onValueChange = (value: string) => setBuildingId(value);

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
    <form action={action} className="max-w-xl space-y-4">
      {selectedBuilding && !hasSystems ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Este building no tiene sistemas configurados (pump/fire). Edita el
          building.
        </div>
      ) : null}
      <div>
        <label className="mb-1 block text-sm font-medium">Building</label>
        <select
          name="building_id"
          required
          value={buildingId}
          onChange={(event) => onValueChange(event.target.value)}
          className="w-full rounded border px-3 py-2"
        >
          <option value="">Selecciona un building</option>
          {buildings.map((building) => (
            <option key={building.id} value={building.id}>
              {building.name}
            </option>
          ))}
        </select>
      </div>
      {buildingId ? (
        <div>
          <label className="mb-1 block text-sm font-medium">
            Equipos a revisar (opcional)
          </label>
          {equipmentForBuilding.length > 0 ? (
            <div className="space-y-2">
              {equipmentForBuilding.map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="equipment_ids" value={item.id} />
                  <span>{item.name}</span>
                  <span className="text-xs text-gray-500">
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
          <p className="mt-2 text-xs text-gray-500">
            Si no seleccionas equipos, la visita queda a nivel building (legacy).
          </p>
        </div>
      ) : null}
      <div>
        <label className="mb-1 block text-sm font-medium">Template</label>
        <select
          name="template_id"
          required
          disabled={!buildingId}
          className="w-full rounded border px-3 py-2"
        >
          <option value="">
            {buildingId
              ? "Selecciona un template"
              : "Selecciona un building primero"}
          </option>
          {filteredTemplates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} (
              {CATEGORY_LABELS[template.category] ?? template.category})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Scheduled for</label>
        <input
          type="date"
          name="scheduled_for"
          required
          className="w-full rounded border px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Assign tech</label>
        <select
          name="assigned_tech_user_id"
          required
          className="w-full rounded border px-3 py-2"
        >
          <option value="">Selecciona un tech</option>
          {techs.map((tech) => (
            <option key={tech.user_id} value={tech.user_id}>
              {tech.full_name?.trim() || `Usuario ${tech.user_id.slice(0, 6)}`}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-3">
        <button type="submit" className="rounded bg-black px-4 py-2 text-white">
          Create visit
        </button>
        <Link
          href="/ops/dashboard"
          className="rounded border px-4 py-2 text-gray-700"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
