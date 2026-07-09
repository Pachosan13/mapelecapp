"use client";

import { useState, useTransition } from "react";

type LabelOption = { value: string; label: string };

const MAX_DIM = 1600; // lado más largo tras el downscale
const WEBP_QUALITY = 0.82;

// Comprime en el navegador ANTES de subir: downscale a 1600px + WebP.
// Devuelve el archivo original (sin tocar) cuando no se puede/no conviene:
//  - HEIC/HEIF: el navegador (fuera de Safari) no lo dibuja en canvas → lo
//    convierte el server (heic-convert).
//  - PDF o no-imagen: pasa directo.
//  - Si el WebP sale más pesado que el original, se queda con el original.
async function compressImage(file: File): Promise<File> {
  const type = (file.type || "").toLowerCase();
  const isHeic = /heic|heif/.test(type) || /\.(heic|heif)$/i.test(file.name);
  if (type === "application/pdf" || isHeic || !type.startsWith("image/")) {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_DIM / longest);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY)
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
  } catch {
    return file; // cualquier fallo → sube el original, nunca se pierde la foto
  }
}

export default function EquipmentPhotoUpload({
  action,
  labelOptions,
}: {
  action: (formData: FormData) => void | Promise<void>;
  labelOptions: LabelOption[];
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [stats, setStats] = useState<{ before: number; after: number } | null>(
    null
  );
  const [label, setLabel] = useState("");
  const [isPending, startTransition] = useTransition();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).filter((f) => f.size > 0);
    if (!picked.length) {
      setFiles([]);
      setStats(null);
      return;
    }
    setCompressing(true);
    const before = picked.reduce((s, f) => s + f.size, 0);
    const compressed = await Promise.all(picked.map(compressImage));
    const after = compressed.reduce((s, f) => s + f.size, 0);
    setFiles(compressed);
    setStats({ before, after });
    setCompressing(false);
  }

  function onSubmit() {
    if (!files.length) return;
    const fd = new FormData();
    fd.set("media_label", label);
    for (const f of files) fd.append("media_file", f);
    startTransition(() => {
      action(fd);
    });
  }

  const fmt = (bytes: number) =>
    bytes >= 1024 * 1024
      ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
      : `${Math.round(bytes / 1024)} KB`;

  const busy = compressing || isPending;

  return (
    <div className="mt-4 space-y-3">
      <select
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="block w-full rounded border px-3 py-2 text-sm"
      >
        <option value="">Etiqueta (opcional): ¿qué es esta foto?</option>
        {labelOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf"
        onChange={onPick}
        className="block w-full rounded border px-3 py-2 text-sm file:mr-3 file:rounded file:border file:px-3 file:py-1.5"
      />
      <p className="text-xs text-gray-500">
        Selecciona TODAS las fotos juntas (no de una en una). Se optimizan en tu
        equipo antes de subir para que pesen poco.
      </p>

      {compressing ? (
        <p className="text-xs font-medium text-slate-600">Optimizando fotos…</p>
      ) : null}
      {stats && !compressing ? (
        <p className="text-xs text-green-700">
          {files.length} foto{files.length === 1 ? "" : "s"} lista
          {files.length === 1 ? "" : "s"}: {fmt(stats.before)} → {fmt(stats.after)}
          {stats.after < stats.before
            ? ` (−${Math.round((1 - stats.after / stats.before) * 100)}%)`
            : ""}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onSubmit}
        disabled={busy || !files.length}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Subiendo…" : "Subir fotos"}
      </button>
    </div>
  );
}
