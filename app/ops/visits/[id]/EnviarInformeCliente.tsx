"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enviarInformeAlCliente } from "./actions";

export type EnvioPrevio = {
  id: string;
  cuando: string;
  para: string[];
  ok: boolean;
  por: string;
};

/**
 * Enviar el informe al cliente (pedido de William, 14-oct-2026). El gerente revisa el PDF,
 * confirma o corrige los correos del cliente y lo manda con un clic. Abajo queda cada envío:
 * a quién, cuándo y quién lo mandó, para que no se mande dos veces ni se quede sin mandar.
 */
export default function EnviarInformeCliente({
  visitId,
  correosEdificio,
  envios,
  configurado,
}: {
  visitId: string;
  correosEdificio: string[];
  envios: EnvioPrevio[];
  configurado: boolean;
}) {
  const [correos, setCorreos] = useState(correosEdificio.join(", "));
  const [nota, setNota] = useState("");
  const [guardar, setGuardar] = useState(correosEdificio.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [enviadoA, setEnviadoA] = useState<string[] | null>(null);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  const yaEnviado = envios.some((e) => e.ok);
  const correosCambiaron =
    correos.trim() !== correosEdificio.join(", ") && correosEdificio.length > 0;

  const enviar = () => {
    setError(null);
    setEnviadoA(null);
    startTransition(async () => {
      const r = await enviarInformeAlCliente(visitId, correos, nota, guardar);
      if (r?.error) {
        setError(r.error);
        return;
      }
      setEnviadoA(r.enviadoA ?? []);
      setNota("");
      router.refresh();
    });
  };

  return (
    <div className="mb-6 rounded border p-4" data-testid="enviar-cliente">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-gray-700">Enviar informe al cliente</div>
        {yaEnviado ? (
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
            Ya enviado
          </span>
        ) : (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            Sin enviar
          </span>
        )}
      </div>
      <p className="mt-1 mb-3 text-sm text-gray-500">
        Revisa el PDF con «Ver reporte» y mándalo. Sale de tu correo con el PDF adjunto.
      </p>

      {!configurado ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          El envío de correos todavía no está configurado. Avísale a Pacho.
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="mb-1 block text-gray-600">Correos del cliente</span>
            <input
              type="text"
              data-testid="enviar-correos"
              value={correos}
              onChange={(e) => setCorreos(e.target.value)}
              placeholder="administracion@edificio.com, gerente@edificio.com"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-300 focus:outline-none"
            />
          </label>
          {correosEdificio.length === 0 || correosCambiaron ? (
            <label className="flex items-center gap-2 text-gray-600">
              <input
                type="checkbox"
                data-testid="enviar-guardar"
                checked={guardar}
                onChange={(e) => setGuardar(e.target.checked)}
              />
              Guardar como los correos de este edificio
            </label>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-gray-600">Nota para el cliente (opcional)</span>
            <textarea
              data-testid="enviar-nota"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="P. ej. la bomba jockey necesita cambio de sello; les enviamos cotización."
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-300 focus:outline-none"
            />
          </label>
          {error ? (
            <p data-testid="enviar-error" className="text-red-700">
              {error}
            </p>
          ) : null}
          {enviadoA ? (
            <p data-testid="enviar-ok" className="text-green-700">
              Enviado a {enviadoA.join(", ")}.
            </p>
          ) : null}
          <button
            type="button"
            data-testid="enviar-boton"
            onClick={enviar}
            disabled={pendiente || !correos.trim()}
            className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pendiente ? "Enviando…" : yaEnviado ? "Enviar de nuevo" : "Enviar al cliente"}
          </button>
        </div>
      )}

      {envios.length > 0 ? (
        <ul className="mt-4 space-y-1 border-t pt-3 text-xs text-gray-500" data-testid="enviar-historial">
          {envios.map((e) => (
            <li key={e.id}>
              <span className={e.ok ? "text-green-700" : "text-red-700"}>
                {e.ok ? "Enviado" : "Falló"}
              </span>{" "}
              · {e.cuando} · a {e.para.join(", ")} · por {e.por}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
