"use client";

import { useEffect, useRef, useState } from "react";
import type { SignerRole } from "@/lib/media/service";
import { addPhoto, removePhoto } from "@/lib/offline/photoQueue";

type SignaturePadProps = {
  visitId: string;
  disabled?: boolean;
  /** Roles que YA tienen firma en esta visita. Firmar de nuevo la reemplaza. */
  signedRoles?: SignerRole[];
};

// ⚠️ POR QUÉ ESTO NO ES UN <form> (3-ago-2026, reporte de William)
//
// Antes la firma se mandaba con un submit directo al servidor. Era la ÚNICA pieza
// del formulario sin guardado offline: las respuestas van a un outbox en
// localStorage y las fotos a una cola en IndexedDB, pero la firma salía directo.
// En un sótano sin señal el botón se quedaba en "Guardando firma…" y no guardaba
// NADA. Verificado en prod el 3-ago: de 7 visitas completadas ese día, 2 quedaron
// con todas sus respuestas y CERO firmas (Pacific Hills Elite 500 y PH Vitri).
//
// Ahora: el PNG se guarda PRIMERO en el equipo (misma cola de IndexedDB que las
// fotos, que sobrevive recarga y cierre de la app) y recién después se intenta
// subir. Sin señal queda encolada y sube sola al reconectar.

// Pad de firma (feedback SEMCO): el cliente firma de recibido en el celular del
// técnico, igual que la línea "Recibido por" de los formularios originales.
export default function SignaturePad({
  visitId,
  disabled = false,
  signedRoles = [],
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [role, setRole] = useState<SignerRole>("cliente");
  const [estado, setEstado] = useState<
    "idle" | "guardando" | "guardada" | "encolada" | "error"
  >("idle");
  const [firmados, setFirmados] = useState<SignerRole[]>(signedRoles);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Ajustar resolución interna al tamaño visible (nitidez en móvil).
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(2, 2);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1a2347";
    }
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  };

  const end = () => {
    drawing.current = false;
  };

  // Guarda la firma: DURABLE primero, subida después. Nunca al revés.
  const guardar = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk || disabled) return;
    setEstado("guardando");

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), "image/png")
    );
    if (!blob) {
      setEstado("error");
      return;
    }

    const nombre = (nameRef.current?.value ?? "").trim();
    const slug =
      nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) ||
      "recibido";

    // 1) Durable en el equipo. Si la app se cierra acá, la firma NO se pierde.
    const entry = await addPhoto({
      visitId,
      system: null,
      name: `firma-${slug}.png`,
      type: "image/png",
      size: blob.size,
      blob,
      kind: "signature",
      signerRole: role,
    });

    setFirmados((prev) => (prev.includes(role) ? prev : [...prev, role]));

    // 2) Intento de subida inmediata. Si falla, queda en cola y la sube sola
    //    OfflinePhotoCapture al volver la señal.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setEstado("encolada");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", new File([blob], `firma-${slug}.png`, { type: "image/png" }));
      fd.append("visit_id", visitId);
      fd.append("kind", "signature");
      fd.append("signer_role", role);
      const res = await fetch("/api/tech/media", { method: "POST", body: fd });
      if (res.ok) {
        await removePhoto(entry.id);
        setEstado("guardada");
      } else {
        setEstado("encolada");
      }
    } catch {
      setEstado("encolada");
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasInk(false);
    setEstado("idle");
  };

  const alreadySigned = firmados.includes(role);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Firma</label>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          ¿Quién firma?
        </label>
        <select
          name="signer_role"
          value={role}
          onChange={(e) => setRole(e.target.value as SignerRole)}
          disabled={disabled}
          className="block w-full rounded border px-3 py-2 text-sm"
        >
          <option value="cliente">Recibido por el cliente</option>
          <option value="tecnico">Técnico responsable</option>
        </select>
      </div>
      {alreadySigned ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Ya hay una firma guardada para este rol. Si firmas de nuevo,{" "}
          <strong>se reemplaza</strong> — no se agrega otra.
        </p>
      ) : null}
      <input
        ref={nameRef}
        type="text"
        placeholder="Nombre de quien firma"
        disabled={disabled}
        className="block w-full rounded border px-3 py-2 text-sm"
      />
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="h-36 w-full touch-none rounded border border-dashed border-slate-300 bg-white"
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {hasInk ? "Firma capturada ✓" : "Firme aquí con el dedo."}
        </p>
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          className="rounded border px-3 py-1.5 text-xs text-gray-700"
        >
          Limpiar
        </button>
      </div>
      <button
        type="button"
        onClick={guardar}
        disabled={disabled || !hasInk || estado === "guardando"}
        className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {estado === "guardando" ? "Guardando firma…" : "Guardar firma"}
      </button>

      {estado === "guardada" ? (
        <p className="rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
          Firma guardada ✓
        </p>
      ) : null}
      {estado === "encolada" ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <strong>Firma guardada en el equipo.</strong> Se sube sola cuando vuelva
          la señal — ya no se pierde aunque cierres la app.
        </p>
      ) : null}
      {estado === "error" ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          No pude leer la firma. Vuelve a firmar, por favor.
        </p>
      ) : null}
    </div>
  );
}
