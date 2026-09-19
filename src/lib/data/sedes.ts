import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { UsuarioActual } from "@/lib/auth/usuario-actual";

export type SedeConMarca = {
  id: string;
  nombre: string;
  marca_id: string;
  marca_nombre: string;
};

/**
 * Marcas y sedes visibles para el usuario actual, ya filtradas por RLS
 * (sede_aislamiento / marcas_lectura / sedes_lectura) — no hace falta
 * repetir el filtro acá, alcanza con pedirle a Supabase los datos.
 */
export async function getSedesVisibles(): Promise<SedeConMarca[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sedes")
    .select("id, nombre, marca_id, marcas(nombre)")
    .eq("activo", true)
    .order("nombre");

  if (error || !data) return [];

  return data.map((fila) => {
    const marca = fila.marcas as unknown as { nombre: string } | null;
    return {
      id: fila.id as string,
      nombre: fila.nombre as string,
      marca_id: fila.marca_id as string,
      marca_nombre: marca?.nombre ?? "",
    };
  });
}

/**
 * Resuelve cuál es la sede "activa" para la pantalla actual:
 * - Usuario de una sola sede: siempre la suya (el selector no aplica).
 * - Admin de marca / maestro: la que venga en el query param `?sede=`, si
 *   es una de las visibles; si no hay ninguna válida, la primera visible.
 */
export function resolverSedeActiva(
  usuario: Pick<UsuarioActual, "sede_id">,
  sedesVisibles: SedeConMarca[],
  sedeParam: string | undefined
): SedeConMarca | null {
  if (usuario.sede_id) {
    return sedesVisibles.find((s) => s.id === usuario.sede_id) ?? null;
  }

  if (sedeParam) {
    const encontrada = sedesVisibles.find((s) => s.id === sedeParam);
    if (encontrada) return encontrada;
  }

  return sedesVisibles[0] ?? null;
}
