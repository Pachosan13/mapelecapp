import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { getProfileById, updateProfile } from "@/lib/profiles/queries";
import type { Role } from "@/types/database";

type SearchParams = {
  saved?: string;
  error?: string;
};

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: "tech", label: "Tech" },
  { value: "ops_manager", label: "Ops Manager" },
  { value: "director", label: "Director" },
];

async function updateStaffProfile(formData: FormData) {
  "use server";

  const user = await getCurrentUser();
  if (!user || user.role !== "ops_manager") {
    redirect("/unauthorized");
  }

  const userId = String(formData.get("user_id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "") as Role;
  const isActive = formData.get("is_active") === "on";

  if (!userId || !role) {
    redirect("/ops/staff?error=Datos%20inv%C3%A1lidos");
  }

  if (user.id === userId && (role !== "ops_manager" || !isActive)) {
    redirect(
      `/ops/staff/${userId}/edit?error=${encodeURIComponent(
        "No puedes quitarte tu propio acceso."
      )}`
    );
  }

  const { error } = await updateProfile(userId, {
    full_name: fullName || null,
    role,
    is_active: isActive,
  });

  if (error) {
    redirect(
      `/ops/staff/${userId}/edit?error=${encodeURIComponent(
        "No se pudo guardar el perfil."
      )}`
    );
  }

  redirect(`/ops/staff/${userId}/edit?saved=1`);
}

export default async function EditStaffPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: SearchParams;
}) {
  const { data: profile, error } = await getProfileById(params.id);

  if (error) {
    return (
      <div className="min-h-screen p-8">
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando perfil: {error.message}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen p-8">
        <div className="rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
          Perfil no encontrado.
        </div>
        <Link
          href="/ops/staff"
          className="mt-4 inline-flex text-sm text-blue-600 hover:underline"
        >
          Volver a personal
        </Link>
      </div>
    );
  }

  const displayName =
    profile.full_name?.trim() || `Usuario ${profile.user_id.slice(0, 6)}`;

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href="/ops/staff" className="text-sm text-gray-500">
          ← Volver a personal
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Editar perfil</h1>
        <p className="text-gray-600">{displayName}</p>
      </div>

      {searchParams?.error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {decodeURIComponent(searchParams.error)}
        </div>
      ) : null}

      {searchParams?.saved ? (
        <div className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Saved
        </div>
      ) : null}

      <form action={updateStaffProfile} className="max-w-xl space-y-4">
        <input type="hidden" name="user_id" value={profile.user_id} />
        <div>
          <label className="mb-1 block text-sm font-medium">Full name</label>
          <input
            type="text"
            name="full_name"
            defaultValue={profile.full_name ?? ""}
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Role</label>
          <select
            name="role"
            defaultValue={profile.role}
            className="w-full rounded border px-3 py-2"
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            defaultChecked={profile.is_active}
          />
          <label htmlFor="is_active" className="text-sm font-medium">
            Active
          </label>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="rounded bg-black px-4 py-2 text-white">
            Save
          </button>
          <Link
            href="/ops/staff"
            className="rounded border px-4 py-2 text-gray-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
