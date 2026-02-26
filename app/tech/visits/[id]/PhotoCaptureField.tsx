"use client";

import { useMemo, useState } from "react";

type PhotoCaptureFieldProps = {
  disabled?: boolean;
};

export default function PhotoCaptureField({ disabled = false }: PhotoCaptureFieldProps) {
  const [fileName, setFileName] = useState("");

  const helperText = useMemo(() => {
    if (!fileName) return "JPG, PNG, WEBP o PDF (máx. 10MB).";
    return `Archivo seleccionado: ${fileName}`;
  }, [fileName]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Evidencia (foto/documento)</label>
      <input
        type="file"
        name="media_file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        capture="environment"
        disabled={disabled}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          setFileName(file?.name ?? "");
        }}
        className="block w-full rounded border px-3 py-2 text-sm file:mr-3 file:rounded file:border file:px-3 file:py-1.5"
      />
      <p className="text-xs text-gray-500">{helperText}</p>
    </div>
  );
}
