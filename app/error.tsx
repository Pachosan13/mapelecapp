"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center gap-4 px-6 py-10">
      <h1 className="text-2xl font-semibold">Algo salio mal</h1>
      <p className="text-sm text-slate-600">
        Ocurrio un error inesperado. Puedes intentar nuevamente.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
      >
        Reintentar
      </button>
      <p className="text-xs text-slate-400">
        {error.digest ? `Codigo: ${error.digest}` : "Sin codigo de error."}
      </p>
    </main>
  );
}
