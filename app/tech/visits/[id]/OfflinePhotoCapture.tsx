"use client";

import { photoSystemOptions } from "@/lib/equipment/systems";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addPhoto,
  listPhotos,
  removePhoto,
  setPhotoError,
  type QueuedPhoto,
} from "@/lib/offline/photoQueue";
import { MAX_UPLOAD_BYTES, comprimirImagen } from "@/lib/media/compress";
import { track } from "@/lib/telemetry/fieldEvents";

const RESYNC_INTERVAL = 15000;

/** En palabras del técnico, no del server. */
const motivoDelRechazo = (status: number): string => {
  if (status === 413) return "La foto pesa demasiado. Tómala de nuevo.";
  if (status === 401 || status === 403)
    return "Se cerró la sesión. Vuelve a entrar y reintenta.";
  return `El servidor no la aceptó (error ${status}).`;
};

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
  buildingSystems = [],
}: {
  visitId: string;
  disabled?: boolean;
  /** Sistemas que este edificio tiene. Vacío → se ofrece el catálogo completo. */
  buildingSystems?: string[];
}) {
  const router = useRouter();
  // Arranca SIN elegir y no deja capturar hasta que el técnico escoja. Antes la
  // primera opción era "General (sin sistema)" y quedaba puesta por defecto: 252 de
  // 308 fotos (82%) llegaron sin sistema, y en el informe salía un manómetro sin
  // forma de saber si era de las bombas principales o de la reforzadora (William,
  // 6-ago-2026). La elección se queda pegada entre fotos: solo se toca al cambiar
  // de sistema, no en cada disparo.
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
        // Las rechazadas no se reintentan solas: el server ya dijo que no las
        // acepta y machacar el enlace del sótano con ellas atrasa a las demás.
        // Quedan a la vista con su motivo y el técnico decide.
        if (p.error) continue;
        const fd = new FormData();
        fd.append("file", new File([p.blob], p.name || "foto.jpg", { type: p.type }));
        fd.append("visit_id", p.visitId);
        if (p.system) fd.append("system", p.system);
        // Las firmas viajan por esta misma cola desde el 3-ago-2026. Sin `kind`
        // el endpoint las trata como evidencia, que es lo correcto para las fotos
        // que ya estaban encoladas antes del cambio.
        if (p.kind === "signature") {
          fd.append("kind", "signature");
          fd.append("signer_role", p.signerRole ?? "cliente");
        }
        try {
          const res = await fetch("/api/tech/media", { method: "POST", body: fd });
          if (res.ok) {
            await removePhoto(p.id);
            uploaded++;
          } else if (res.status >= 400 && res.status < 500 && res.status !== 408) {
            // Error de validación/permiso (no de red). ANTES esto BORRABA el blob
            // "para no reintentar en bucle" — y con él la evidencia, en silencio.
            // Ahora se marca y se muestra: el 413 de una foto pesada y el 401 de
            // una sesión vencida son justo lo que pasa tras un rato sin señal.
            track(visitId, "photo_rejected", { status: res.status, bytes: p.size, kind: p.kind ?? "evidence" });
            await setPhotoError(p.id, motivoDelRechazo(res.status));
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

  const systemOptions = photoSystemOptions(buildingSystems);

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files ?? []);
    e.currentTarget.value = ""; // permite re-seleccionar el mismo archivo
    if (files.length === 0) return;
    // Cinturón además del input deshabilitado: sin sistema no se encola nada.
    if (!system) return;
    for (const original of files) {
      if (original.size === 0) continue;
      // Achicar ANTES de encolar: así no viaja por el enlace del sótano una foto
      // de 8MB que además la plataforma rechazaría (ver lib/media/compress).
      const f = await comprimirImagen(original).catch(() => original);
      // Si aun así no cabe (típico: HEIC de iPhone, que no se puede comprimir en
      // el navegador), se guarda IGUAL pero marcada. Nunca se descarta la foto
      // por la espalda: el técnico la ve en rojo y decide si la vuelve a tomar.
      const noCabe = f.size > MAX_UPLOAD_BYTES;
      await addPhoto({
        visitId,
        system: system || null,
        name: f.name || "foto.jpg",
        type: f.type || "image/jpeg",
        size: f.size,
        blob: f,
        ...(noCabe
          ? {
              error: `Pesa ${(f.size / 1024 / 1024).toFixed(1)}MB y el máximo es ${(
                MAX_UPLOAD_BYTES /
                1024 /
                1024
              ).toFixed(0)}MB. Tómala de nuevo con menos resolución.`,
            }
          : {}),
      }).catch(() => null);
    }
    await refresh();
    void flush();
  };

  // Reintento manual de una foto rechazada, y descarte DELIBERADO.
  const reintentar = async (id: string) => {
    await setPhotoError(id, null).catch(() => null);
    await refresh();
    void flush();
  };
  const quitar = async (id: string) => {
    await removePhoto(id).catch(() => null);
    await refresh();
  };

  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const rechazadas = photos.filter((p) => p.error);
  const enCola = photos.filter((p) => !p.error);
  const pendingCount = enCola.length;

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">Evidencia (foto/documento)</label>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Sistema al que pertenece <span className="text-red-600">*</span>
        </label>
        <select
          value={system}
          onChange={(e) => setSystem(e.target.value)}
          disabled={disabled}
          className={`block w-full rounded border px-3 py-2 text-sm ${
            system ? "" : "border-amber-400 bg-amber-50"
          }`}
        >
          <option value="">— Elige el sistema —</option>
          {systemOptions.map(([v, l]) => (
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
        disabled={disabled || !system}
        onChange={onFiles}
        className="block w-full rounded border px-3 py-2 text-sm file:mr-3 file:rounded file:border file:px-3 file:py-1.5 disabled:cursor-not-allowed disabled:bg-gray-100"
      />
      {!system && !disabled ? (
        <p className="text-xs font-medium text-amber-700">
          Elige el sistema antes de tomar la foto. Sin eso, en el informe sale un
          manómetro que nadie puede ubicar.
        </p>
      ) : null}
      <p className="text-xs text-gray-500">
        Toma o selecciona las fotos. Se guardan en el equipo al instante y se suben
        solas cuando haya señal. JPG, PNG o iPhone/HEIC. Se achican solas para que
        suban rápido; si alguna no se puede subir, te aviso acá y no se borra.
      </p>

      {pendingCount > 0 ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-800">
            {offline
              ? `Sin señal — ${pendingCount} foto(s) guardada(s) en el equipo, se subirán solas`
              : `Subiendo ${pendingCount} foto(s)…`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {enCola.map((p) => (
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

      {/* Las rechazadas, A LA VISTA. Antes desaparecían solas y el técnico se
          quedaba creyendo que la evidencia estaba subida. */}
      {rechazadas.length > 0 ? (
        <div className="rounded border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-medium text-red-800">
            {rechazadas.length === 1
              ? "1 foto no se pudo subir. Sigue guardada en el equipo."
              : `${rechazadas.length} fotos no se pudieron subir. Siguen guardadas en el equipo.`}
          </p>
          <ul className="mt-2 space-y-2">
            {rechazadas.map((p) => (
              <li key={p.id} className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={urlFor(p)}
                  alt={p.name}
                  className="h-16 w-16 shrink-0 rounded border border-red-300 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-xs text-red-700">{p.error}</p>
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void reintentar(p.id)}
                      disabled={disabled}
                      className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
                    >
                      Reintentar
                    </button>
                    <button
                      type="button"
                      onClick={() => void quitar(p.id)}
                      disabled={disabled}
                      className="rounded border px-2 py-1 text-xs text-gray-600 disabled:opacity-50"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
