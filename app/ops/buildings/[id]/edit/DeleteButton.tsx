"use client";

type DeleteButtonProps = {
  label?: string;
  className?: string;
};

export default function DeleteButton({
  label = "Delete",
  className,
}: DeleteButtonProps) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!confirm("¿Eliminar building? Esta acción no se puede deshacer.")) {
          event.preventDefault();
        }
      }}
    >
      {label}
    </button>
  );
}
