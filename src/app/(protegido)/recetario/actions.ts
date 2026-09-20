"use server";

import { obtenerDetalleRecetario, type RecetarioDetalle } from "@/lib/data/recetario";

/**
 * Server Action que llama el modal de detalle del Recetario (cliente) al
 * hacer clic en una tarjeta — así no hace falta navegar a otra página.
 */
export async function cargarDetalleRecetario(
  tipo: "receta" | "subreceta",
  id: string
): Promise<RecetarioDetalle | null> {
  return obtenerDetalleRecetario(tipo, id);
}
