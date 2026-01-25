import Link from "next/link";
import { getAllProfiles } from "@/lib/profiles/queries";

const roleLabelMap: Record<string, string> = {
  tech: "Tech",
  ops_manager: "Ops Manager",
  director: "Director",
};

export default async function StaffPage() {
  const { data: profiles, error } = await getAllProfiles();

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href="/ops/dashboard" className="text-sm text-gray-500">
          ← Volver a dashboard
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Staff / Personal</h1>
          <Link
            href="/ops/staff/invite"
            className="rounded border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Invitar técnico
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando personal: {error.message}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {profiles.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={4}>
                  No hay personal para mostrar.
                </td>
              </tr>
            ) : (
              profiles.map((profile) => {
                const displayName =
                  profile.full_name?.trim() ||
                  `Usuario ${profile.user_id.slice(0, 6)}`;
                const roleLabel = roleLabelMap[profile.role] ?? profile.role;
                return (
                  <tr key={profile.user_id} className="border-t">
                    <td className="px-4 py-3 font-medium">{displayName}</td>
                    <td className="px-4 py-3">{roleLabel}</td>
                    <td className="px-4 py-3">
                      {profile.is_active ? (
                        <span className="rounded-full bg-green-50 px-2 py-1 text-xs text-green-700">
                          Activo
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/ops/staff/${profile.user_id}/edit`}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
