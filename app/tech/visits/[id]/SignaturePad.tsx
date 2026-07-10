"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { SignerRole } from "@/lib/media/service";

type SignaturePadProps = {
  disabled?: boolean;
  /** Roles que YA tienen firma en esta visita. Firmar de nuevo la reemplaza. */
  signedRoles?: SignerRole[];
};

// El botón vive dentro del <form> para poder leer useFormStatus: en 4G de campo
// el submit tarda, y sin bloquearlo el técnico lo aprieta otra vez. Así nacieron
// las 30 firmas duplicadas que encontramos el 10-jul.
function SubmitSignature({ hasInk }: { hasInk: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || !hasInk}
      className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Guardando firma…" : "Guardar firma"}
    </button>
  );
}

// Pad de firma (feedback SEMCO): el cliente firma de recibido en el celular del
// técnico, igual que la línea "Recibido por" de los formularios originales.
export default function SignaturePad({
  disabled = false,
  signedRoles = [],
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenRef = useRef<HTMLInputElement | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [role, setRole] = useState<SignerRole>("cliente");
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
    const canvas = canvasRef.current;
    if (canvas && hiddenRef.current) {
      hiddenRef.current.value = hasInk || drawing.current ? canvas.toDataURL("image/png") : "";
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (hiddenRef.current) hiddenRef.current.value = "";
    setHasInk(false);
  };

  const alreadySigned = signedRoles.includes(role);

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
        type="text"
        name="signature_name"
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
      <input ref={hiddenRef} type="hidden" name="signature_data" />
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
      <SubmitSignature hasInk={hasInk} />
    </div>
  );
}
