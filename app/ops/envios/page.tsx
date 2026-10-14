import Link from "next/link";
import { getPanamaTodayDateString } from "@/lib/dates/panama";
import { esFechaValida, sumarDias } from "@/lib/fact/rango";
import { listarCompletados } from "@/lib/fact/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  contarPendientes,
  estadoPorVisita,
  inicioDeLista,
  type EnvioRegistrado,
} from "@/lib/envios/pendientes";

export const dynamic = "force-dynamic";

// Informes por enviar al cliente (pedido de William, 14-oct-2026). Lista los mantenimientos
// completados y si su informe ya salió. Cada fila abre la visita, donde está el botón de envío.
// Protegida por requireRole(["ops_manager"]) en app/ops/layout.tsx; `report_sends` solo se
// lee con el cliente admin.

const VENTANAS = [7, 30, 60, 90] as const;

const PANAMA = "America/Panama";
const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-PA", {
    timeZone: PANAMA,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));

const diaCorto = (dia: string) =>
  new Intl.DateTimeFormat("es-PA", { timeZone: "UTC", day: "numeric", month: "short" }).format(
    new Date(`${dia}T12:00:00Z`)
  );

const href = (p: { dias?: number; ver?: string }) => {
  const q = new URLSearchParams();
  if (p.dias) q.set("dias", String(p.dias));
  if (p.ver) q.set("ver", p.ver);
  const s = q.toString();
  return s ? `/ops/envios?${s}` : "/ops/envios";
};

export default async function EnviosPage({
  searchParams,
}: {
  searchParams?: { dias?: string; ver?: string };
}) {
  const dias = VENTANAS.find((d) => String(d) === searchParams?.dias) ?? 30;
  const verTodos = searchParams?.ver === "todos";
  const hoy = getPanamaTodayDateString();
  const inicio = inicioDeLista(hoy, dias, process.env.ENVIOS_DESDE, esFechaValida, sumarDias);
  const { filas, error } = await listarCompletados(inicio.desde, hoy);

  const admin = createAdminClient();
  const ids = filas.map((f) => f.id);
  const envios: EnvioRegistrado[] = [];
  // Por tandas: una lista larga de ids en `in()` revienta el largo de la URL de PostgREST.
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await admin
      .from("report_sends")
      .select("visit_id,status,created_at")
      .in("visit_id", ids.slice(i, i + 150));
    envios.push(...(data ?? []));
  }
  const estados = estadoPorVisita(envios);

  const edificioIds = Array.from(new Set(filas.map((f) => f.edificioId)));
  const conCorreo = new Set<string>();
  for (let i = 0; i < edificioIds.length; i += 150) {
    const { data } = await admin
      .from("buildings")
      .select("id,client_emails")
      .in("id", edificioIds.slice(i, i + 150));
    (data ?? []).forEach((b) => {
      if ((b.client_emails ?? []).length > 0) conCorreo.add(b.id);
    });
  }

  const pendientes = contarPendientes(ids, estados);
  const visibles = verTodos
    ? filas
    : filas.filter((f) => (estados.get(f.id)?.estado ?? "sin_enviar") !== "enviado");

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Envíos al cliente</h1>
        <p className="mt-1 text-sm text-gray-500">
          Mantenimientos completados y si su informe ya se le mandó al cliente. Abre la visita para
          revisar el PDF y enviarlo.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {VENTANAS.map((d) => (
          <Link
            key={d}
            href={href({ dias: d, ver: verTodos ? "todos" : undefined })}
            aria-current={d === dias ? "true" : undefined}
            className={
              d === dias
                ? "rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                : "rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            }
          >
            Últimos {d} días
          </Link>
        ))}
        <span className="mx-1 text-gray-300">|</span>
        <Link
          href={href({ dias, ver: verTodos ? undefined : "todos" })}
          className="text-sm text-blue-600 hover:underline"
        >
          {verTodos ? "Ver solo los que faltan" : "Ver también los enviados"}
        </Link>
      </div>

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} Recarga la página; si sigue igual, avísale a Pacho.
        </p>
      ) : (
        <p className="mb-4 text-sm text-gray-700" data-testid="envios-resumen">
          <b>{pendientes}</b> de <b>{filas.length}</b> informes sin enviar{" "}
          {inicio.recortado
            ? `desde el ${diaCorto(inicio.desde)}, día en que se estrenó el envío`
            : `en los últimos ${dias} días`}
          .
        </p>
      )}

      {!error && visibles.length === 0 ? (
        <p className="rounded border bg-white px-4 py-6 text-sm text-gray-500">
          {verTodos ? "No hay mantenimientos completados en este rango." : "Todo enviado. 🎉"}
        </p>
      ) : null}

      {visibles.length > 0 ? (
        <div className="overflow-hidden rounded border bg-white">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-[14%] px-4 py-2 font-medium">Completado</th>
                <th className="w-[24%] px-4 py-2 font-medium">Edificio</th>
                <th className="w-[26%] px-4 py-2 font-medium">Formulario</th>
                <th className="w-[22%] px-4 py-2 font-medium">Envío</th>
                <th className="w-[14%] px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => {
                const e = estados.get(f.id);
                const estado = e?.estado ?? "sin_enviar";
                return (
                  <tr key={f.id} className="border-t border-gray-100" data-visit-id={f.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">{fechaHora(f.completedAt)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {f.edificio}
                      {!conCorreo.has(f.edificioId) ? (
                        <span className="ml-2 text-[11px] font-normal text-amber-700">sin correo</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{f.formulario}</td>
                    <td className="px-4 py-3">
                      {estado === "enviado" ? (
                        <span className="text-green-700">Enviado · {fechaHora(e!.ultimo)}</span>
                      ) : estado === "fallo" ? (
                        <span className="text-red-700">Falló · {fechaHora(e!.ultimo)}</span>
                      ) : (
                        <span className="text-amber-700">Sin enviar</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/ops/visits/${f.id}`}
                        className="inline-flex rounded-full bg-gray-900 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
