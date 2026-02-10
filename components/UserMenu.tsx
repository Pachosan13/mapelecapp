 "use client";

 import { useEffect, useRef, useState } from "react";
 import Link from "next/link";

 type UserMenuProps = {
   displayName: string;
   roleLabel: string;
   logoutAction: () => void;
 };

 export default function UserMenu({
   displayName,
   roleLabel,
   logoutAction,
 }: UserMenuProps) {
   const [open, setOpen] = useState(false);
   const menuRef = useRef<HTMLDivElement | null>(null);

   useEffect(() => {
     const handleClickOutside = (event: MouseEvent) => {
       if (!menuRef.current) return;
       if (!menuRef.current.contains(event.target as Node)) {
         setOpen(false);
       }
     };

     const handleEscape = (event: KeyboardEvent) => {
       if (event.key === "Escape") {
         setOpen(false);
       }
     };

     document.addEventListener("mousedown", handleClickOutside);
     document.addEventListener("keydown", handleEscape);
     return () => {
       document.removeEventListener("mousedown", handleClickOutside);
       document.removeEventListener("keydown", handleEscape);
     };
   }, []);

   return (
     <div className="relative" ref={menuRef}>
       <button
         type="button"
         onClick={() => setOpen((prev) => !prev)}
         className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm text-gray-700 transition hover:bg-gray-50 hover:text-gray-900"
         aria-haspopup="menu"
         aria-expanded={open}
       >
         <span>{displayName} · {roleLabel}</span>
         <svg
           viewBox="0 0 20 20"
           fill="currentColor"
           className="h-4 w-4 text-gray-400"
           aria-hidden="true"
         >
           <path
             fillRule="evenodd"
             d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.25a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
             clipRule="evenodd"
           />
         </svg>
       </button>

       {open ? (
         <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-black/5">
           <Link
             href="/debug/me"
             className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
             onClick={() => setOpen(false)}
           >
             Perfil
           </Link>
          <Link
            href="/ops/staff"
             className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
             onClick={() => setOpen(false)}
           >
             Equipos
           </Link>
           <Link
             href="/ops/templates"
             className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
             onClick={() => setOpen(false)}
           >
             Formularios
           </Link>
           <Link
             href="/debug/me#preferencias"
             className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
             onClick={() => setOpen(false)}
           >
             Preferencias
           </Link>
           <div className="my-1 h-px bg-gray-100" />
           <form action={logoutAction}>
             <button
               type="submit"
               className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
             >
               Cerrar sesión
             </button>
           </form>
         </div>
       ) : null}
     </div>
   );
 }
