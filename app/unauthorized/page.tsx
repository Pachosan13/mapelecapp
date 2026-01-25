export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="max-w-md w-full rounded-lg bg-white p-6 shadow">
        <h1 className="text-2xl font-bold text-gray-900">Acceso no autorizado</h1>
        <p className="mt-2 text-sm text-gray-600">
          No tienes permisos para ver esta pagina.
        </p>
      </div>
    </div>
  );
}
