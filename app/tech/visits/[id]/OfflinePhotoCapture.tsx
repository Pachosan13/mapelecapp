"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addPhoto,
  listPhotos,
  removePhoto,
  type QueuedPhoto,
} from "@/lib/offline/photoQueue";

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

const RESYNC_INTERVAL = 15000;

/**
 * Captura de evidencia offline-first.
 *
 * La foto se guarda PRIMERO en IndexedDB (sobrevive sótano + recarga + cierre de app)
 * y se sube sola vía /api/tech/media al reconectar. Reemplaza el <form> que subía
 * directo al server (que offline perdía la foto). Las fotos ya subidas y confirmadas
 * aparecen en la lista "Evidencia subida" del server al recargar.
 */
export default function OfflinePhotoCapture({
  visitId,
  disabled = false,
}: {
  visitId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [system, setSystem] = useState("");
  const [photos, setPhotos] = useState<QueuedPhoto[]>([]);
  const urls = useRef<Map<string, string>>(new Map());
  const [, forceRerender] = useState(0);
  const flushing = useRef(false);

  const urlFor = (p: QueuedPhoto) => {
    let u = urls.current.get(p.id);
    if (!u) {
      u = URL.createObjectURL(p.blob);
      urls.current.set(p.id, u);
    }
    return u;
  };

  const refresh = useCallback(async () => {
    const list = await listPhotos(visitId).catch(() => [] as QueuedPhoto[]);
    // Limpiar object URLs de fotos que ya no están en la cola.
    const liveIds = new Set(list.map((p) => p.id));
    for (const [id, u] of urls.current) {
      if (!liveIds.has(id)) {
        URL.revokeObjectURL(u);
        urls.current.delete(id);
      }
    }
    setPhotos(list);
  }, [visitId]);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    flushing.current = true;
    let uploaded = 0;
    try {
      const list = await listPhotos(visitId).catch(() => [] as QueuedPhoto[]);
      for (const p of list) {
        const fd = new FormData();
        fd.append("file", new File([p.blob], p.name || "foto.jpg", { type: p.type }));
        fd.append("visit_id", p.visitId);
        if (p.system) fd.append("system", p.system);
        try {
          const res = await fetch("/api/tech/media", { method: "POST", body: fd });
          if (res.ok) {
            await removePhoto(p.id);
            uploaded++;
          } else if (res.status >= 400 && res.status < 500 && res.status !== 408) {
            // Error de validación/permiso (no de red): quitar para no reintentar
            // en bucle una foto que el server nunca va a aceptar.
            await removePhoto(p.id);
          } else {
            break; // 5xx u otro: reintentar luego
          }
        } catch {
          break; // sin red: dejar el resto en la cola
        }
      }
    } finally {
      flushing.current = false;
      await refresh();
      forceRerender((n) => n + 1);
      // La lista "Evidencia subida" la pinta el server component al cargar la
      // página. Sin esto, la foto sale de la cola local al subirse y no entra
      // en esa lista hasta recargar: el técnico ve el hueco y cree que se
      // perdió. Solo refrescamos si algo subió, para no recargar en cada tick.
      if (uploaded > 0) router.refresh();
    }
  }, [visitId, refresh, router]);

  useEffect(() => {
    void refresh().then(() => void flush());
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    const interval = window.setInterval(() => {
      if (!(typeof navigator !== "undefined" && navigator.onLine === false)) void flush();
    }, RESYNC_INTERVAL);
    const snapshot = urls.current;
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(interval);
      for (const u of snapshot.values()) URL.revokeObjectURL(u);
      snapshot.clear();
    };
  }, [refresh, flush]);

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files ?? []);
    e.currentTarget.value = ""; // permite re-seleccionar el mismo archivo
    if (files.length === 0) return;
    for (const f of files) {
      if (f.size === 0) continue;
      await addPhoto({
        visitId,
        system: system || null,
        name: f.name || "foto.jpg",
        type: f.type || "image/jpeg",
        size: f.size,
        blob: f,
      }).catch(() => null);
    }
    await refresh();
    void flush();
  };

  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const pendingCount = photos.length;

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">Evidencia (foto/documento)</label>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Sistema al que pertenece
        </label>
        <select
          value={system}
          onChange={(e) => setSystem(e.target.value)}
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
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf"
        disabled={disabled}
        onChange={onFiles}
        className="block w-full rounded border px-3 py-2 text-sm file:mr-3 file:rounded file:border file:px-3 file:py-1.5"
      />
      <p className="text-xs text-gray-500">
        Toma o selecciona las fotos. Se guardan en el equipo al instante y se suben
        solas cuando haya señal. JPG, PNG o iPhone/HEIC. Máx. 10MB c/u.
      </p>

      {pendingCount > 0 ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-800">
            {offline
              ? `Sin señal — ${pendingCount} foto(s) guardada(s) en el equipo, se subirán solas`
              : `Subiendo ${pendingCount} foto(s)…`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.map((p) => (
              <div key={p.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={urlFor(p)}
                  alt={p.name}
                  className="h-16 w-16 rounded border border-amber-300 object-cover opacity-90"
                />
                <span className="absolute inset-x-0 bottom-0 bg-amber-600/80 text-center text-[9px] font-semibold text-white">
                  {offline ? "en equipo" : "subiendo…"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
