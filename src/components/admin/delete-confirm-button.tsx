"use client";

interface Props {
  message?: string;
  label?: string;
  className?: string;
}

export function DeleteConfirmButton({
  message = "¿Eliminar? Esta acción no se puede deshacer.",
  label = "Eliminar",
  className = "text-xs text-red-500 hover:text-red-700",
}: Props) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {label}
    </button>
  );
}
