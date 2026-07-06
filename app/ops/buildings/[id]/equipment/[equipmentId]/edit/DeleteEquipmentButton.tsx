"use client";

export default function DeleteEquipmentButton({
  className,
}: {
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (
          !confirm("¿Eliminar este equipo? Esta acción no se puede deshacer.")
        ) {
          event.preventDefault();
        }
      }}
    >
      Eliminar equipo
    </button>
  );
}
