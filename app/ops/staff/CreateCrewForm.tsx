"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCrew } from "./actions";

export default function CreateCrewForm() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"pump" | "fire">("pump");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setMessage({ ok: false, text: "Escribe un nombre para la cuadrilla." });
      return;
    }
    startTransition(async () => {
      const result = await createCrew({ name: cleanName, category });
      if (result?.error) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      setMessage({ ok: true, text: `Cuadrilla "${cleanName}" creada.` });
      setName("");
      router.refresh();
    });
  };

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">Crear cuadrilla</h2>
      <p className="mt-1 text-sm text-gray-500">
        Crea una cuadrilla nueva y luego asígnale técnicos abajo.
      </p>
      <form
        onSubmit={handleSubmit}
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Nombre
          </label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej: Cuadrilla Luis Alonso"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-300 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Categoría
          </label>
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value === "fire" ? "fire" : "pump")
            }
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-300 focus:outline-none sm:w-40"
          >
            <option value="pump">Bombas</option>
            <option value="fire">Incendio</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-gray-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
        >
          {isPending ? "Creando…" : "Crear cuadrilla"}
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
