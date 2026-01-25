"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export default function InviteTechPage() {
  const [copied, setCopied] = useState(false);
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  const inviteUrl = useMemo(() => `${siteUrl}/login`, [siteUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href="/ops/staff" className="text-sm text-gray-500">
          ← Volver a personal
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Invitar técnico</h1>
      </div>

      <div className="max-w-xl space-y-6">
        <p className="text-gray-700">
          Los técnicos crean su usuario registrándose en el sistema. Luego
          aparecerán aquí para asignarles nombre y permisos.
        </p>

        <div className="rounded border bg-white p-4">
          <div className="text-sm font-medium text-gray-700">Link</div>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={inviteUrl}
              className="rounded bg-gray-100 px-3 py-2 text-sm text-gray-800"
              target="_blank"
              rel="noreferrer"
            >
              {inviteUrl}
            </Link>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded bg-black px-4 py-2 text-sm text-white"
            >
              {copied ? "Copiado" : "Copiar link"}
            </button>
          </div>
        </div>

        <div className="rounded border bg-white p-4">
          <div className="mb-2 text-sm font-medium text-gray-700">
            Checklist
          </div>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>✅ Enviar link</li>
            <li>✅ Técnico se registra</li>
            <li>✅ Ops lo activa y asigna rol</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
