import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/supabase/server";

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

  const links =
    role === "tech"
      ? [{ href: "/tech/today", label: "Today" }]
      : role === "ops_manager"
        ? [
            { href: "/ops/dashboard", label: "Dashboard" },
            { href: "/ops/buildings", label: "Buildings" },
            { href: "/ops/templates", label: "Templates" },
            { href: "/ops/visits/new", label: "New Visit" },
          ]
        : role === "director"
          ? [
              { href: "/dir/overview", label: "Overview" },
              { href: "/ops/buildings", label: "Buildings" },
            ]
          : [];

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold text-gray-900">
            MAPELEC
          </Link>
          <nav className="flex items-center gap-4 text-sm text-gray-700">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-gray-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>
            {user.email ?? "Usuario"} · {roleLabel} ({role}) · {user.id}
          </span>
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
