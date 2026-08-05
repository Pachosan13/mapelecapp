 "use client";

 import { useEffect, useMemo, useRef, useState } from "react";
 import { enqueue, pending } from "@/lib/offline/outbox";
 import { readSnapshot, saveSnapshot } from "@/lib/offline/recorridoSnapshot";
 import {
   emptyRow,
   mergeRows,
   type RecorridoRowDraft,
 } from "@/lib/offline/recorridoMerge";

 type RecorridoRowValue = {
   piso: string;
   presion_entrada: number | null;
   presion_salida: number | null;
   estacion_control_abierta: boolean;
   estacion_control_cerrada: boolean;
   valvula_reguladora: boolean;
   estado_manometro: boolean;
   gabinetes_manguera: boolean;
   extintores: boolean;
   observacion: string;
 };

 const toNumberOrNull = (value: string): number | null => {
   const trimmed = value.trim();
   if (!trimmed) return null;
   const parsed = Number(trimmed);
   return Number.isFinite(parsed) ? parsed : null;
 };

 const toDraft = (value: RecorridoRowValue): RecorridoRowDraft => ({
   piso: value.piso ?? "",
   presion_entrada:
     value.presion_entrada !== null && value.presion_entrada !== undefined
       ? value.presion_entrada.toString()
       : "",
   presion_salida:
     value.presion_salida !== null && value.presion_salida !== undefined
       ? value.presion_salida.toString()
       : "",
   estacion_control_abierta: Boolean(value.estacion_control_abierta),
   estacion_control_cerrada: Boolean(value.estacion_control_cerrada),
   valvula_reguladora: Boolean(value.valvula_reguladora),
   estado_manometro: Boolean(value.estado_manometro),
   gabinetes_manguera: Boolean(value.gabinetes_manguera),
   extintores: Boolean(value.extintores),
   observacion: value.observacion ?? "",
 });

 const DEFAULT_FLOOR_COUNT = 70;

 const generateDefaultRows = (count: number): RecorridoRowDraft[] =>
   Array.from({ length: count }, (_, i) => ({
     ...emptyRow(),
     piso: String(i + 1),
   }));

 const parseInitialRows = (rawValue?: string | null): RecorridoRowDraft[] => {
   if (!rawValue) return generateDefaultRows(DEFAULT_FLOOR_COUNT);
   try {
     const parsed = JSON.parse(rawValue);
     if (!Array.isArray(parsed)) return generateDefaultRows(DEFAULT_FLOOR_COUNT);
     const rows = parsed
       .map((row) => {
         if (!row || typeof row !== "object") return null;
         return toDraft(row as RecorridoRowValue);
       })
       .filter(Boolean) as RecorridoRowDraft[];
     return rows.length > 0 ? rows : generateDefaultRows(DEFAULT_FLOOR_COUNT);
   } catch {
     return generateDefaultRows(DEFAULT_FLOOR_COUNT);
   }
 };

 export default function RecorridoTable({
   itemId,
   defaultValue,
   disabled,
   visitId,
 }: {
   itemId: string;
   defaultValue?: string | null;
   disabled?: boolean;
   /** cuando viene, la tabla persiste offline al outbox (durable + resync) */
   visitId?: string;
 }) {
   // El estado arranca EXACTAMENTE con lo que pintó el server. Es a propósito:
   // React no corrige el `value` de un input al hidratar, así que calcular acá la
   // versión buena dejaba el estado correcto pero la PANTALLA con el HTML viejo.
   // (Costó un E2E descubrirlo: el arreglo "funcionaba" y el técnico igual veía
   // los pisos en blanco.) La corrección va en el efecto de abajo, ya montado.
   const [rows, setRows] = useState<RecorridoRowDraft[]>(() =>
     parseInitialRows(defaultValue)
   );
   const [floorCount, setFloorCount] = useState<string>(String(DEFAULT_FLOOR_COUNT));
   // Solo persistimos tras una edición REAL del usuario (no en el montaje/hidratación).
   const touched = useRef(false);

   // Rehidratación a prueba de HTML viejo, ya montado. FUSIONA con lo que pintó el
   // server en vez de reemplazarlo: el service worker sirve la página cacheada al
   // recargar sin señal y ese HTML puede ser anterior a lo que el técnico ya subió.
   // Orden de confianza:
   //   1) lo pendiente de subir en el outbox — lo más nuevo que existe
   //   2) la última copia local del recorrido — sobrevive a la sincronización
   //   3) lo que vino del server
   useEffect(() => {
     if (!visitId) return;
     try {
       const p = pending(visitId).find(
         (e) => e.payload.kind === "response" && `item-${e.payload.itemId}` === `item-${itemId}`
       );
       const enCola = p && p.payload.kind === "response" ? p.payload.valueText : null;
       const local =
         typeof enCola === "string" && enCola.length > 0
           ? enCola
           : readSnapshot(visitId, itemId);
       if (!local) return;
       // No marca `touched`: reponer lo que ya era del técnico no es una edición.
       setRows((previas) => mergeRows(previas, parseInitialRows(local)));
     } catch {
       /* storage no disponible: se queda con lo del server */
     }
   }, [visitId, itemId]);

   const serialized = useMemo(() => {
     const normalized: RecorridoRowValue[] = rows.map((row) => ({
       piso: row.piso.trim(),
       presion_entrada: toNumberOrNull(row.presion_entrada),
       presion_salida: toNumberOrNull(row.presion_salida),
       estacion_control_abierta: row.estacion_control_abierta,
       estacion_control_cerrada: row.estacion_control_cerrada,
       valvula_reguladora: row.valvula_reguladora,
       estado_manometro: row.estado_manometro,
       gabinetes_manguera: row.gabinetes_manguera,
       extintores: row.extintores,
       observacion: row.observacion.trim(),
     }));
     return JSON.stringify(normalized);
   }, [rows]);

   // Última versión serializada, para poder volcarla desde un listener sin
   // re-suscribirlo en cada tecla.
   const ultimaSerializada = useRef(serialized);
   useEffect(() => {
     ultimaSerializada.current = serialized;
   }, [serialized]);

   // Escribe el recorrido en el equipo. `enqueue` lo pone en la cola de subida y
   // `saveSnapshot` deja la copia que sobrevive a esa subida (ver recorridoSnapshot).
   const persistir = (valor: string) => {
     if (!visitId) return;
     enqueue(visitId, { kind: "response", itemId, valueText: valor });
     saveSnapshot(visitId, itemId, valor);
     // Avisarle al drenador para que suba ya, en vez de esperar su tick de 15 s:
     // en campo esos 15 s pueden ser justo los que había de señal.
     window.dispatchEvent(new Event("semco:outbox"));
   };

   // Autosave DURABLE del recorrido: cada cambio se guarda al outbox (localStorage),
   // debounced. El AutosaveManager de la visita lo sube y re-sincroniza al reconectar.
   // Sin visitId (o completada) no persiste — se comporta como antes.
   useEffect(() => {
     if (!visitId || disabled || !touched.current) return;
     const t = window.setTimeout(() => persistir(serialized), 800);
     return () => window.clearTimeout(t);
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [serialized, visitId, disabled, itemId]);

   // ⚠️ VOLCADO DE EMERGENCIA. Mientras el técnico escribe seguido, cada tecla
   // reinicia el debounce de 800 ms y NO se guarda nada: si la página se recarga
   // o el sistema mata la app en ese rato, se pierde TODO lo tecleado desde la
   // última pausa — el recorrido entero, porque viaja como un solo bloque.
   // Encontrado el 5-ago-2026 MIRANDO la pantalla: el E2E daba verde y los 8
   // pisos igual salían en blanco tras recargar.
   // `pagehide` + `visibilitychange` es el par que sí dispara en Android cuando
   // el sistema se lleva la app (`beforeunload` no es confiable en móvil).
   useEffect(() => {
     if (!visitId || disabled) return;
     const volcar = () => {
       if (!touched.current) return;
       persistir(ultimaSerializada.current);
     };
     const alOcultarse = () => {
       if (document.visibilityState === "hidden") volcar();
     };
     window.addEventListener("pagehide", volcar);
     document.addEventListener("visibilitychange", alOcultarse);
     return () => {
       window.removeEventListener("pagehide", volcar);
       document.removeEventListener("visibilitychange", alOcultarse);
     };
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [visitId, disabled, itemId]);

   const updateRow = (index: number, patch: Partial<RecorridoRowDraft>) => {
     touched.current = true;
     setRows((prev) =>
       prev.map((row, rowIndex) =>
         rowIndex === index ? { ...row, ...patch } : row
       )
     );
   };

   const addRow = () => {
     touched.current = true;
     setRows((prev) => [...prev, emptyRow()]);
   };

   const handleGenerateRows = () => {
     const count = parseInt(floorCount, 10);
     if (!count || count < 1 || count > 200) return;
     touched.current = true;
     setRows(generateDefaultRows(count));
   };

   const removeRow = (index: number) => {
     touched.current = true;
     setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
   };

   return (
     <div className="space-y-3">
       <input type="hidden" name={`item-${itemId}`} value={serialized} />
       {!disabled && (
         <div className="flex items-end gap-2">
           <div>
             <label className="mb-1 block text-xs font-medium text-gray-600">
               Cantidad de pisos
             </label>
             <input
               type="number"
               value={floorCount}
               onChange={(e) => setFloorCount(e.target.value)}
               min={1}
               max={200}
               className="w-20 rounded border px-2 py-1 text-sm"
             />
           </div>
           <button
             type="button"
             onClick={handleGenerateRows}
             className="rounded border px-3 py-1 text-sm text-gray-700"
           >
             Generar filas
           </button>
         </div>
       )}
       {/* Encabezado y columna "Piso" FIJOS (5-ago-2026).
           Son 70 filas × 11 columnas: al llegar al piso 40 el técnico veía tres
           cajas y seis casillas sin nombre, y al correrse a la derecha para
           marcar "Extintores" perdía de vista en qué piso estaba.
           El `sticky` necesita que el scroll vertical sea el de ESTE contenedor
           —con solo `overflow-x-auto` el que scrollea es la página y el
           encabezado se va igual—, de ahí la altura máxima. */}
       <div className="max-h-[65vh] overflow-auto rounded border">
         <table className="min-w-full text-left text-xs">
           <thead className="sticky top-0 z-20 bg-gray-50 text-gray-600 shadow-[0_1px_0_0_rgb(229,231,235)]">
             <tr>
               <th className="sticky left-0 z-30 bg-gray-50 px-3 py-2 font-medium">
                 Piso
               </th>
               <th className="px-3 py-2 font-medium">Presión entrada</th>
               <th className="px-3 py-2 font-medium">Presión salida</th>
               <th className="px-3 py-2 font-medium">Estación control abierta</th>
               <th className="px-3 py-2 font-medium">Estación control cerrada</th>
               <th className="px-3 py-2 font-medium">Válvula reguladora</th>
               <th className="px-3 py-2 font-medium">Estado manómetro</th>
               <th className="px-3 py-2 font-medium">Gabinetes/manguera</th>
               <th className="px-3 py-2 font-medium">Extintores</th>
               <th className="px-3 py-2 font-medium">Observación</th>
               <th className="px-3 py-2 font-medium">Acciones</th>
             </tr>
           </thead>
           <tbody>
             {rows.length === 0 ? (
               <tr className="border-t">
                 <td className="px-3 py-4 text-gray-500" colSpan={11}>
                   Sin filas.
                 </td>
               </tr>
             ) : null}
             {rows.map((row, index) => (
               <tr key={index} className="border-t align-top">
                 {/* Fondo opaco: al correr la tabla, las otras columnas pasan
                     POR DEBAJO de esta. Sin él se leen encimadas. */}
                 <td className="sticky left-0 z-10 bg-white px-3 py-2">
                   <input
                     type="text"
                     value={row.piso}
                     onChange={(event) =>
                       updateRow(index, { piso: event.target.value })
                     }
                     disabled={disabled}
                     className="w-28 rounded border px-2 py-1"
                   />
                 </td>
                 <td className="px-3 py-2">
                   <input
                     type="number"
                     step="any"
                     inputMode="decimal"
                     value={row.presion_entrada}
                     onChange={(event) =>
                       updateRow(index, { presion_entrada: event.target.value })
                     }
                     disabled={disabled}
                     className="w-28 rounded border px-2 py-1"
                   />
                 </td>
                 <td className="px-3 py-2">
                   <input
                     type="number"
                     step="any"
                     inputMode="decimal"
                     value={row.presion_salida}
                     onChange={(event) =>
                       updateRow(index, { presion_salida: event.target.value })
                     }
                     disabled={disabled}
                     className="w-28 rounded border px-2 py-1"
                   />
                 </td>
                 <td className="px-3 py-2 text-center">
                   <input
                     type="checkbox"
                     checked={row.estacion_control_abierta}
                     onChange={(event) =>
                       updateRow(index, {
                         estacion_control_abierta: event.target.checked,
                       })
                     }
                     disabled={disabled}
                   />
                 </td>
                 <td className="px-3 py-2 text-center">
                   <input
                     type="checkbox"
                     checked={row.estacion_control_cerrada}
                     onChange={(event) =>
                       updateRow(index, {
                         estacion_control_cerrada: event.target.checked,
                       })
                     }
                     disabled={disabled}
                   />
                 </td>
                 <td className="px-3 py-2 text-center">
                   <input
                     type="checkbox"
                     checked={row.valvula_reguladora}
                     onChange={(event) =>
                       updateRow(index, { valvula_reguladora: event.target.checked })
                     }
                     disabled={disabled}
                   />
                 </td>
                 <td className="px-3 py-2 text-center">
                   <input
                     type="checkbox"
                     checked={row.estado_manometro}
                     onChange={(event) =>
                       updateRow(index, { estado_manometro: event.target.checked })
                     }
                     disabled={disabled}
                   />
                 </td>
                 <td className="px-3 py-2 text-center">
                   <input
                     type="checkbox"
                     checked={row.gabinetes_manguera}
                     onChange={(event) =>
                       updateRow(index, { gabinetes_manguera: event.target.checked })
                     }
                     disabled={disabled}
                   />
                 </td>
                 <td className="px-3 py-2 text-center">
                   <input
                     type="checkbox"
                     checked={row.extintores}
                     onChange={(event) =>
                       updateRow(index, { extintores: event.target.checked })
                     }
                     disabled={disabled}
                   />
                 </td>
                 <td className="px-3 py-2">
                   <input
                     type="text"
                     value={row.observacion}
                     onChange={(event) =>
                       updateRow(index, { observacion: event.target.value })
                     }
                     disabled={disabled}
                     className="w-40 rounded border px-2 py-1"
                   />
                 </td>
                 <td className="px-3 py-2">
                   <button
                     type="button"
                     onClick={() => removeRow(index)}
                     disabled={disabled}
                     className="rounded border px-2 py-1 text-xs text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                   >
                     Eliminar fila
                   </button>
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
       <button
         type="button"
         onClick={addRow}
         disabled={disabled}
         className="rounded border px-3 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
       >
         + Agregar fila
       </button>
     </div>
   );
 }
