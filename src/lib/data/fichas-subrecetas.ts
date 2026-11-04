import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Ficha técnica de una subreceta — mismo patrón que `fichas.ts` (Recetas),
 * pero guardada en `fichas_tecnicas_subreceta` en vez de `fichas_tecnicas`.
 * No incluye `foto_url`: la foto de la subreceta sigue viviendo en
 * `subrecetas.foto_url` (no se duplicó al agregar esta tabla).
 */
export type FichaTecnicaSubreceta = {
  subreceta_id: string;
  preparacion: string | null;
  emplatado: string | null;
  notas: string | null;
  tiempo_min: number | null;
  gramaje_porcion: number | null;
};

export async function obtenerFichaPorSubreceta(
  subrecetaId: string
): Promise<FichaTecnicaSubreceta | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fichas_tecnicas_subreceta")
    .select("subreceta_id, preparacion, emplatado, notas, tiempo_min, gramaje_porcion")
    .eq("subreceta_id", subrecetaId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    ...data,
    tiempo_min: data.tiempo_min === null ? null : Number(data.tiempo_min),
    gramaje_porcion: data.gramaje_porcion === null ? null : Number(data.gramaje_porcion),
  };
}
