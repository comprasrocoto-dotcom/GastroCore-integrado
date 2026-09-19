import "server-only";
import { createClient } from "@/lib/supabase/server";

export type RecetarioFila = {
  receta_id: string;
  receta_nombre: string;
  familia_nombre: string | null;
  rendimiento: number | null;
  unidad_rendimiento_codigo: string | null;
};

/**
 * Datos para cocina: nombre, familia, preparación, emplatado — nunca
 * costos, precios ni márgenes. Lee de las vistas recetario_publico /
 * recetario_publico_ingredientes (security_invoker = true, ver migración
 * 0030), así que la RLS de siempre sigue filtrando por sede.
 */
export async function listarRecetario(sedeId: string): Promise<RecetarioFila[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("recetario_publico")
    .select("receta_id, receta_nombre, familia_nombre, rendimiento, unidad_rendimiento_codigo")
    .eq("sede_id", sedeId)
    .eq("activo", true)
    .order("receta_nombre");

  if (error || !data) return [];
  return data as RecetarioFila[];
}

export async function obtenerRecetarioDetalle(recetaId: string) {
  const supabase = createClient();
  const [{ data: receta }, { data: ingredientes }] = await Promise.all([
    supabase
      .from("recetario_publico")
      .select("*")
      .eq("receta_id", recetaId)
      .maybeSingle(),
    supabase
      .from("recetario_publico_ingredientes")
      .select("orden, descripcion, cantidad, unidad_codigo")
      .eq("receta_id", recetaId)
      .order("orden"),
  ]);

  if (!receta) return null;
  return { receta, ingredientes: ingredientes ?? [] };
}
