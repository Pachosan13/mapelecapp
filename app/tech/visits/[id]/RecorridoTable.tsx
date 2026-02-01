 "use client";

 import { useMemo, useState } from "react";

 type RecorridoRowDraft = {
   piso: string;
   presion_entrada: string;
   presion_salida: string;
   estacion_control_abierta: boolean;
   estacion_control_cerrada: boolean;
   valvula_reguladora: boolean;
   estado_manometro: boolean;
   gabinetes_manguera: boolean;
   extintores: boolean;
   observacion: string;
 };

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

 const emptyRow = (): RecorridoRowDraft => ({
   piso: "",
   presion_entrada: "",
   presion_salida: "",
   estacion_control_abierta: false,
   estacion_control_cerrada: false,
   valvula_reguladora: false,
   estado_manometro: false,
   gabinetes_manguera: false,
   extintores: false,
   observacion: "",
 });

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

 const parseInitialRows = (rawValue?: string | null): RecorridoRowDraft[] => {
   if (!rawValue) return [];
   try {
     const parsed = JSON.parse(rawValue);
     if (!Array.isArray(parsed)) return [];
     return parsed
       .map((row) => {
         if (!row || typeof row !== "object") return null;
         return toDraft(row as RecorridoRowValue);
       })
       .filter(Boolean) as RecorridoRowDraft[];
   } catch {
     return [];
   }
 };

 export default function RecorridoTable({
   itemId,
   defaultValue,
   disabled,
 }: {
   itemId: string;
   defaultValue?: string | null;
   disabled?: boolean;
 }) {
   const [rows, setRows] = useState<RecorridoRowDraft[]>(
     parseInitialRows(defaultValue)
   );

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

   const updateRow = (index: number, patch: Partial<RecorridoRowDraft>) => {
     setRows((prev) =>
       prev.map((row, rowIndex) =>
         rowIndex === index ? { ...row, ...patch } : row
       )
     );
   };

   const addRow = () => {
     setRows((prev) => [...prev, emptyRow()]);
   };

   const removeRow = (index: number) => {
     setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
   };

   return (
     <div className="space-y-3">
       <input type="hidden" name={`item-${itemId}`} value={serialized} />
       <div className="overflow-x-auto rounded border">
         <table className="min-w-full text-left text-xs">
           <thead className="bg-gray-50 text-gray-600">
             <tr>
               <th className="px-3 py-2 font-medium">Piso</th>
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
               <tr key={`${index}-${row.piso}`} className="border-t align-top">
                 <td className="px-3 py-2">
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
