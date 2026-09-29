"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Actualiza precio real y estado (activo/inactivo) de una receta desde el
 * Panel Ejecutivo — misma receta de escritura que `actualizarFotoReceta`
 * en recetas/actions.ts (upsert/update simple + revalidatePath), aplicada
 * acá a `recetas.precio_real` y `recetas.activo`, las mismas columnas que
 * ya usa el resto de la app (RecetaForm, listarRecetas). No toca costo —
 * eso sigue derivándose siempre de los ingredientes.
 */
export async function actualizarPrecioYEstadoReceta(
  recetaId: string,
  sedeId: string,
  precioReal: number,
  activo: boolean
) {
  if (!recetaId || !sedeId || !(precioReal > 0)) return;

  const supabase = createClient();
  await supabase
    .from("recetas")
    .update({ precio_real: precioReal, activo })
    .eq("id", recetaId)
    .eq("sede_id", sedeId);

  revalidatePath("/panel");
  revalidatePath("/recetas");
  revalidatePath(`/recetas/${recetaId}`);
  revalidatePath("/recetario");
}
