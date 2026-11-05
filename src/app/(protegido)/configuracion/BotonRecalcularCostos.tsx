"use client";

/**
 * Botón "Recalcular todos los costos" con confirmación antes de enviar.
 * Separado en su propio Client Component porque un Server Component (la
 * página de Configuración) no puede pasarle un `onClick` a un botón
 * directamente — eso rompía la pantalla con "Event handlers cannot be
 * passed to Client Component props".
 */
export default function BotonRecalcularCostos({
  sedeId,
  accion,
}: {
  sedeId: string;
  accion: (formData: FormData) => void;
}) {
  return (
    <form action={accion}>
      <input type="hidden" name="sede_id" value={sedeId} />
      <button
        type="submit"
        className="btn-secondary self-start"
        onClick={(e) => {
          if (!confirm("¿Recalcular el costo de todas las subrecetas y recetas de esta sede?")) {
            e.preventDefault();
          }
        }}
      >
        Recalcular todos los costos
      </button>
    </form>
  );
}
