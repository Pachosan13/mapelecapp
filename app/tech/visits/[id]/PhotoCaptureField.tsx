"use client";

import { useMemo, useState } from "react";

const SYSTEM_OPTIONS: [string, string][] = [
  ["", "General (sin sistema)"],
  ["transferencia_agua_potable", "Transferencia agua potable"],
  ["reforzador_agua_potable", "Reforzador agua potable"],
  ["contra_incendios", "Contra incendios (NFPA)"],
  ["achique_freatico", "Achique freático"],
  ["achique_elevador", "Achique elevador"],
  ["achique_pluvial", "Achique pluvial"],
  ["sanitario", "Sanitario"],
  ["planta_diesel", "Planta diésel"],
];

type PhotoCaptureFieldProps = {
  disabled?: boolean;
};

export default function PhotoCaptureField({ disabled = false }: PhotoCaptureFieldProps) {
  const [fileName, setFileName] = useState("");

  const helperText = useMemo(() => {
    if (!fileName) return "Puedes seleccionar varias. JPG, PNG, WEBP o PDF (máx. 10MB c/u).";
    return `Seleccionado: ${fileName}`;
  }, [fileName]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Evidencia (foto/documento)</label>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Sistema al que pertenece
        </label>
        <select
          name="media_system"
          defaultValue=""
          disabled={disabled}
          className="block w-full rounded border px-3 py-2 text-sm"
        >
          {SYSTEM_OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <input
        type="file"
        name="media_file"
        multiple
        accept="image/jpeg,image/png,image/webp,application/pdf"
        capture="environment"
        disabled={disabled}
        onChange={(event) => {
          const files = event.currentTarget.files;
          setFileName(
            !files || files.length === 0
              ? ""
              : files.length === 1
                ? files[0].name
                : `${files.length} archivos`
          );
        }}
        className="block w-full rounded border px-3 py-2 text-sm file:mr-3 file:rounded file:border file:px-3 file:py-1.5"
      />
      <p className="text-xs text-gray-500">{helperText}</p>
    </div>
  );
}
