"use client";

/**
 * Botón "Actualizar el costo del insumo según lo calculado" de la tarjeta
 * "Maestro en Insumos" (vista de detalle de Subrecetas, 24/11). Separado en
 * su propio Client Component por lo mismo que BotonRecalcularCostos.tsx
 * (Configuración): un Server Component no puede pasarle un `onClick` a un
 * botón. Pide confirmación porque el cambio también recostea, en vivo,
 * todas las recetas que llevan este insumo.
 */
export default function BotonActualizarCostoInsumo({
  subrecetaId,
  insumoId,
  sedeId,
  nuevoCoste,
  accion,
}: {
  subrecetaId: string;
  insumoId: string;
  sedeId: string;
  nuevoCoste: number;
  accion: (formData: FormData) => void;
}) {
  return (
    <form action={accion}>
      <input type="hidden" name="subreceta_id" value={subrecetaId} />
      <input type="hidden" name="insumo_id" value={insumoId} />
      <input type="hidden" name="sede_id" value={sedeId} />
      <input type="hidden" name="nuevo_coste" value={nuevoCoste} />
      <button
        type="submit"
        className="btn-primary text-xs"
        style={{ background: "#D97706" }}
        onClick={(e) => {
          if (
            !confirm(
              "¿Actualizar el costo de este insumo en Insumos con el valor recién calculado?\n\nEsto también recostea, en vivo, todas las recetas que usan este insumo."
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        ⟳ Actualizar el costo del insumo según lo calculado
      </button>
    </form>
  );
}
