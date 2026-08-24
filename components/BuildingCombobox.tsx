"use client";

import { useMemo, useRef, useState } from "react";

export type BuildingOpcion = { id: string; name: string };

type Props = {
  /** name del input oculto que viaja en el form (normalmente "building_id"). */
  name: string;
  buildings: BuildingOpcion[];
  placeholder?: string;
  /** Nombres sugeridos por el parecido del texto de la hoja. Se pintan como atajos. */
  sugerencias?: string[];
  className?: string;
};

/**
 * Buscador de edificio: se escribe y filtra, en vez de bajar por una lista de ~240.
 *
 * Reporte de William (24-ago-2026), sobre la bandeja de hojas por identificar:
 * "haber si me podrías colocar como en los otros el buscar para encontrar rápido los
 * proyectos, cuando bajo con el mouse y suelto se coloca nuevamente en el inicial".
 *
 * Las dos mitades del reclamo salen del mismo `<select>` nativo: con 240 opciones hay
 * que bajar a pulso, y el popup nativo de macOS vuelve solo a la opción seleccionada
 * ("Elegir edificio…", la primera) en cuanto se suelta la rueda. Un input + lista
 * propia no tiene popup nativo, así que no hay a dónde volver.
 *
 * Es el mismo patrón que ya se le puso en /ops/visits/new el 6-jul por el mismo
 * reclamo — de ahí el "como en los otros".
 */
export default function BuildingCombobox({
  name,
  buildings,
  placeholder = "Busca el edificio…",
  sugerencias = [],
  className = "",
}: Props) {
  const [id, setId] = useState("");
  const [query, setQuery] = useState("");
  const [abierto, setAbierto] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return buildings;
    return buildings.filter((b) => b.name.toLowerCase().includes(q));
  }, [buildings, query]);

  const elegir = (b: BuildingOpcion) => {
    setId(b.id);
    setQuery(b.name);
    setAbierto(false);
  };

  // Los "Se parece a" de la hoja, ya resueltos a un edificio real. Es el caso común
  // (el nombre manuscrito matchea con dos fases del mismo PH): un clic en vez de teclear.
  const atajos = useMemo(
    () =>
      sugerencias
        .map((nombre) =>
          buildings.find(
            (b) => b.name.trim().toLowerCase() === nombre.trim().toLowerCase()
          )
        )
        .filter((b): b is BuildingOpcion => Boolean(b)),
    [sugerencias, buildings]
  );

  return (
    <div className={`relative ${className}`}>
      <input type="hidden" name={name} value={id} />
      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setId("");
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        // El blur se atrasa para que alcance a correr el clic sobre la lista.
        onBlur={() => setTimeout(() => setAbierto(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setAbierto(false);
            return;
          }
          // Enter toma la primera coincidencia: escribir "aqua" + Enter y listo.
          if (e.key === "Enter" && abierto && filtrados.length > 0 && !id) {
            e.preventDefault();
            elegir(filtrados[0]);
          }
        }}
        className="w-56 rounded border px-2 py-1 text-sm"
      />
      {atajos.length ? (
        <span className="ml-2 text-xs text-gray-500">
          {atajos.map((b) => (
            <button
              key={b.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(b);
              }}
              className="mr-1 rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-100"
            >
              {b.name}
            </button>
          ))}
        </span>
      ) : null}
      {abierto ? (
        <ul className="absolute z-10 mt-1 max-h-60 w-72 overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg">
          {filtrados.length > 0 ? (
            filtrados.slice(0, 60).map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    elegir(b);
                  }}
                  className={`block w-full px-3 py-2 text-left hover:bg-gray-100 ${
                    b.id === id ? "bg-gray-50 font-medium" : ""
                  }`}
                >
                  {b.name}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-gray-500">
              Ningún edificio con ese nombre. Usa «…o edificio nuevo» de al lado.
            </li>
          )}
          {filtrados.length > 60 ? (
            <li className="px-3 py-2 text-xs text-gray-400">
              {filtrados.length - 60} más. Escribe para afinar.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
