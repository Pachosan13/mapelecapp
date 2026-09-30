import Link from "next/link";
import { getPanamaTodayDateString } from "@/lib/dates/panama";
import { PRESETS, resolverRango } from "@/lib/fact/rango";
import { listarCompletados } from "@/lib/fact/queries";
import {
  agruparPorDia,
  filtrarEdificio,
  opcionesEdificio,
  resumen,
} from "@/lib/fact/agrupar";

export const dynamic = "force-dynamic";

type SearchParams = {
  preset?: string;
  desde?: string;
  hasta?: string;
  edificio?: string;
};

const PANAMA = "America/Panama";

const horaPanama = (iso: string) =>
  new Intl.DateTimeFormat("es-PA", {
    timeZone: PANAMA,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));

// `dia` ya es una fecha de Panamá: se formatea a mediodía UTC para que ningún huso la corra.
const diaLargo = (dia: string) =>
  new Intl.DateTimeFormat("es-PA", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dia}T12:00:00Z`));

const diaCorto = (dia: string) =>
  new Intl.DateTimeFormat("es-PA", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dia}T12:00:00Z`));

const href = (p: Record<string, string | undefined>) => {
  const q = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => {
    if (v) q.set(k, v);
  });
  const s = q.toString();
  return s ? `/fact?${s}` : "/fact";
};

export default async function FacturacionPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const hoy = getPanamaTodayDateString();
  const rango = resolverRango(
    {
      preset: searchParams?.preset,
      desde: searchParams?.desde?.trim(),
      hasta: searchParams?.hasta?.trim(),
    },
    hoy
  );

  const { filas: todas, error } = await listarCompletados(rango.desde, rango.hasta);

  const edificios = opcionesEdificio(todas);
  const edificioId = edificios.some((e) => e.id === searchParams?.edificio)
    ? (searchParams?.edificio as string)
    : "";
  const filas = filtrarEdificio(todas, edificioId);
  const grupos = agruparPorDia(filas);
  const { informes, edificios: nEdificios } = resumen(filas);

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Facturación</h1>
        <p className="mt-1 text-sm text-gray-500">
          Mantenimientos completados y su informe en PDF. Esta vista es solo de consulta.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Rangos rápidos">
        {PRESETS.map((p) => {
          const activo = rango.preset === p.id;
          return (
            <Link
              key={p.id}
              href={href({ preset: p.id, edificio: edificioId || undefined })}
              aria-current={activo ? "true" : undefined}
              className={
                activo
                  ? "rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                  : "rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              }
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      <form method="get" action="/fact" className="mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm text-gray-600">
          <span className="mb-1 block">Desde</span>
          <input
            type="date"
            name="desde"
            defaultValue={rango.desde}
            max={hoy}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>
        <label className="text-sm text-gray-600">
          <span className="mb-1 block">Hasta</span>
          <input
            type="date"
            name="hasta"
            defaultValue={rango.hasta}
            max={hoy}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>
        <label className="text-sm text-gray-600">
          <span className="mb-1 block">Edificio</span>
          <select
            name="edificio"
            defaultValue={edificioId}
            className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
          >
            <option value="">Todos</option>
            {edificios.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-full bg-gray-900 px-5 py-2 text-sm font-medium text-white"
        >
          Filtrar
        </button>
      </form>

      {rango.aviso ? (
        <p className="mb-4 rounded border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {rango.aviso}
        </p>
      ) : null}

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} Recarga la página; si sigue igual, avísale a Pacho.
        </p>
      ) : (
        <p className="mb-4 text-sm text-gray-700" data-testid="resumen">
          <b>{informes}</b> {informes === 1 ? "informe" : "informes"} en{" "}
          <b>{nEdificios}</b> {nEdificios === 1 ? "edificio" : "edificios"} ·{" "}
          {rango.desde === rango.hasta
            ? diaCorto(rango.desde)
            : `del ${diaCorto(rango.desde)} al ${diaCorto(rango.hasta)}`}
        </p>
      )}

      {!error && grupos.length === 0 ? (
        <p className="rounded border bg-white px-4 py-6 text-sm text-gray-500">
          No hay mantenimientos completados en este rango.
        </p>
      ) : null}

      <div className="space-y-6">
        {grupos.map((g) => (
          <section key={g.dia} aria-label={diaLargo(g.dia)}>
            <h2 className="mb-2 text-sm font-semibold capitalize text-gray-800">
              {diaLargo(g.dia)}{" "}
              <span className="font-normal text-gray-500">
                · {g.filas.length} {g.filas.length === 1 ? "informe" : "informes"}
              </span>
            </h2>
            <div className="overflow-hidden rounded border bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Edificio</th>
                    <th className="px-4 py-2 font-medium">Formulario</th>
                    <th className="px-4 py-2 font-medium">Responsable</th>
                    <th className="px-4 py-2 font-medium">Hora</th>
                    <th className="px-4 py-2 font-medium">Informe</th>
                  </tr>
                </thead>
                <tbody>
                  {g.filas.map((f) => (
                    <tr key={f.id} className="border-t border-gray-100" data-visit-id={f.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">{f.edificio}</td>
                      <td className="px-4 py-3 text-gray-700">{f.formulario}</td>
                      <td className="px-4 py-3 text-gray-500">{f.responsable ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                        {horaPanama(f.completedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={`/api/reports/service-report?visitId=${f.id}&view=1`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Ver PDF
                          </a>
                          <a
                            href={`/api/reports/service-report?visitId=${f.id}`}
                            className="inline-flex rounded-full bg-gray-900 px-3 py-1.5 text-xs font-medium text-white"
                          >
                            Descargar
                          </a>
                        </div>
                        <div className="mt-1 max-w-[22rem] truncate text-[11px] text-gray-400" title={f.archivo}>
                          {f.archivo}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
