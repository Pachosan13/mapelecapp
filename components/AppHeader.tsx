import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/supabase/server";
import AppNavLinks from "@/components/AppNavLinks";

const roleLabelMap: Record<string, string> = {
  tech: "Tech",
  ops_manager: "Ops Manager",
  director: "Director",
};

export default async function AppHeader() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const role = user.role ?? "unknown";
  const roleLabel = roleLabelMap[role] ?? "User";
  const displayName =
    user.full_name?.trim() || `Usuario ${user.id.slice(0, 6)}`;

  const links =
    role === "tech"
      ? [{ href: "/tech/today", label: "Today", activeMatch: "exact" }]
      : role === "ops_manager"
        ? [
            { href: "/ops/dashboard", label: "Dashboard", activeMatch: "exact" },
            { href: "/ops/buildings", label: "Buildings", activeMatch: "exact" },
            {
              href: "/ops/visits",
              label: "Agenda",
              activeMatch: "startsWith",
              activeExclude: ["/ops/visits/new"],
            },
            { href: "/ops/templates", label: "Templates", activeMatch: "exact" },
            { href: "/ops/visits/new", label: "New Visit", activeMatch: "exact" },
            { href: "/ops/staff", label: "Personal", activeMatch: "exact" },
          ]
        : role === "director"
          ? [
              { href: "/dir/overview", label: "Overview", activeMatch: "exact" },
              { href: "/ops/buildings", label: "Buildings", activeMatch: "exact" },
            ]
          : [];

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold text-gray-900">
            MAPELEC
          </Link>
          <AppNavLinks links={links} />
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{displayName} · {roleLabel}</span>
          <form action={logout}>
            <button
              type="submit"
              className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
            >
              Logout
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
