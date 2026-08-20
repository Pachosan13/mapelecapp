"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reassignVisitCrew } from "./actions";

type CrewOption = { id: string; label: string };

export default function ReassignCrewForm({
  visitId,
  currentCrewId,
  crews,
}: {
  visitId: string;
  currentCrewId: string | null;
  crews: CrewOption[];
}) {
  const [crewId, setCrewId] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const options = crews.filter((crew) => crew.id !== currentCrewId);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!crewId) {
      setMessage({ ok: false, text: "Selecciona una cuadrilla." });
      return;
    }
    startTransition(async () => {
      const result = await reassignVisitCrew(visitId, crewId);
      if (result?.error) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      const name = options.find((crew) => crew.id === crewId)?.label ?? "";
      setMessage({ ok: true, text: `Visita reasignada a ${name}.` });
      setCrewId("");
      router.refresh();
    });
  };

  return (
    <div className="mb-6 rounded border p-4">
      <div className="text-sm font-semibold text-gray-700">
        Reasignar cuadrilla
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Pasa esta visita a otra cuadrilla para que la continúe. Lo que ya se
        llenó se conserva.
      </p>
      <form
        onSubmit={handleSubmit}
        className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Nueva cuadrilla
          </label>
          <select
            value={crewId}
            onChange={(event) => setCrewId(event.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-300 focus:outline-none"
          >
            <option value="">Selecciona una cuadrilla</option>
            {options.map((crew) => (
              <option key={crew.id} value={crew.id}>
                {crew.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-gray-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
        >
          {isPending ? "Reasignando…" : "Reasignar"}
        </button>
      </form>
      {message ? (
        <p
          className={`mt-3 text-sm ${
            message.ok ? "text-green-700" : "text-red-600"
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
