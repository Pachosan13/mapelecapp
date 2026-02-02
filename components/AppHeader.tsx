import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/supabase/server";
import AppNavLinks from "@/components/AppNavLinks";
import UserMenu from "@/components/UserMenu";

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
      ? [{ href: "/tech/today", label: "Hoy", activeMatch: "exact" }]
      : role === "ops_manager"
        ? [
            { href: "/ops/dashboard", label: "Hoy", activeMatch: "exact" },
            { href: "/ops/buildings", label: "Edificios", activeMatch: "exact" },
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
        <div className="flex items-center text-sm text-gray-600">
          <UserMenu
            displayName={displayName}
            roleLabel={roleLabel}
            logoutAction={logout}
          />
        </div>
      </div>
    </header>
  );
}
