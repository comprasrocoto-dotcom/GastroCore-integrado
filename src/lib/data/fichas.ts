import "server-only";
import { createClient } from "@/lib/supabase/server";

export type FichaTecnica = {
  receta_id: string;
  preparacion: string | null;
  emplatado: string | null;
  notas: string | null;
  foto_url: string | null;
  tiempo_min: number | null;
  gramaje_porcion: number | null;
};

export async function obtenerFichaPorReceta(recetaId: string): Promise<FichaTecnica | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fichas_tecnicas")
    .select("receta_id, preparacion, emplatado, notas, foto_url, tiempo_min, gramaje_porcion")
    .eq("receta_id", recetaId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    ...data,
    tiempo_min: data.tiempo_min === null ? null : Number(data.tiempo_min),
    gramaje_porcion: data.gramaje_porcion === null ? null : Number(data.gramaje_porcion),
  };
}
