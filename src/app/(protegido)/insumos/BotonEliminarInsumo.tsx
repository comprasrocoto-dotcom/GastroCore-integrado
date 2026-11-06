"use client";

/**
 * Botón de "Eliminar" para insumos (06/11, a pedido explícito de Mariluz).
 * Mismo patrón que ya se usa en Marcas y Sedes (20/10): a diferencia del
 * checkbox "Activo" (que siempre se puede deshacer), esto borra la fila
 * de verdad y no se puede recuperar. Por eso pide confirmación acá, y el
 * servidor (ver ./actions.ts) igual vuelve a chequear que el insumo no
 * esté usado como ingrediente de ninguna receta/subreceta ni como insumo
 * maestro de ninguna subreceta antes de borrar — este diálogo es solo
 * para que no se dispare sin querer con un click de más.
 */
export default function BotonEliminarInsumo({ etiqueta }: { etiqueta: string }) {
  return (
    <button
      type="submit"
      className="btn-danger text-sm"
      onClick={(e) => {
        if (
          !confirm(
            `¿Eliminar "${etiqueta}" de verdad? Esta acción no se puede deshacer. Solo funciona si no está siendo usado en ninguna receta o subreceta — si lo está, usá "Activo" para desactivarlo en vez de eliminarlo.`
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
