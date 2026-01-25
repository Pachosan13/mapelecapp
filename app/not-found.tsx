export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center gap-4 px-6 py-10">
      <h1 className="text-2xl font-semibold">Pagina no encontrada</h1>
      <p className="text-sm text-slate-600">
        La ruta que buscas no existe o fue movida.
      </p>
    </main>
  );
}
