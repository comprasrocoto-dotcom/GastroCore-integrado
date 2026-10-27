import "server-only";
import { createClient } from "@/lib/supabase/server";

export type PlantillaPermiso = {
  id: string;
  nombre: string;
  modulos: string[] | null;
  area: "BAR" | "COCINA" | null;
};

/**
 * Plantillas de permisos: un nombre con un conjunto de pantallas + área
 * ya elegido, para aplicárselo de una a varios usuarios desde
 * Configuración (ver PlantillasPermisos.tsx) sin tener que repetir la
 * misma elección usuario por usuario. No es seguridad real: la
 * seguridad de la base de datos sigue dependiendo de `usuarios.rol`
 * (Admin/Chef/Lector) como siempre — esto solo copia valores a
 * `usuarios.modulos`/`usuarios.area` cuando se "aplica" (ver
 * plantillas-actions.ts).
 */
export async function listarPlantillas(): Promise<PlantillaPermiso[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("plantillas_permisos")
    .select("id, nombre, modulos, area")
    .order("nombre");

  if (error || !data) return [];

  return data.map((p) => ({
    id: p.id as string,
    nombre: p.nombre as string,
    modulos: p.modulos as string[] | null,
    area: p.area as "BAR" | "COCINA" | null,
  }));
}
