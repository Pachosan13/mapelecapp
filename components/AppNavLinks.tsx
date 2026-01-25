"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type ActiveMatch = "exact" | "startsWith";

type NavLink = {
  href: string;
  label: string;
  activeMatch?: ActiveMatch;
  activeExclude?: string[];
};

type AppNavLinksProps = {
  links: NavLink[];
};

function isActive(pathname: string, link: NavLink) {
  if (link.activeExclude?.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  if (link.activeMatch === "startsWith") {
    return pathname === link.href || pathname.startsWith(`${link.href}/`);
  }

  return pathname === link.href;
}

export default function AppNavLinks({ links }: AppNavLinksProps) {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex items-center gap-4 text-sm text-gray-700">
      {links.map((link) => {
        const active = isActive(pathname, link);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? "font-semibold text-gray-900"
                : "text-gray-700 hover:text-gray-900"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
