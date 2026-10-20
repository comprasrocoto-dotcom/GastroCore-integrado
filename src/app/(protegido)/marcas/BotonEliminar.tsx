"use client";

/**
 * Botón de "Eliminar" para marcas y sedes (20/10, a pedido explícito de
 * Mariluz). Pide confirmación con un diálogo del navegador antes de
 * mandar el formulario, porque a diferencia de "Activa" (que siempre se
 * puede deshacer), esto borra la fila de verdad y no se puede recuperar.
 * El servidor (ver ./actions.ts) igual vuelve a chequear que no tenga
 * datos cargados antes de borrar — este diálogo es solo para que no se
 * dispare sin querer con un click de más.
 */
export default function BotonEliminar({ etiqueta }: { etiqueta: string }) {
  return (
    <button
      type="submit"
      className="btn-danger"
      onClick={(e) => {
        if (
          !confirm(
            `¿Eliminar "${etiqueta}" de verdad? Esta acción no se puede deshacer. Solo funciona si todavía no tiene datos cargados.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      Eliminar
    </button>
  );
}
