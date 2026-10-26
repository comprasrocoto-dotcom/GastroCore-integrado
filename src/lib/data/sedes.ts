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
 * repetir el filtro acá, alcanza con pedirle a Supabase los datos. Desde
 * el 26/10 esto puede traer más de una sede también para un Chef/Lector
 * (antes siempre traía como mucho una), porque sede_visible() ahora
 * revisa la tabla usuario_sedes en vez de una sola sede fija.
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
 * Resuelve cuál es la sede "activa" para la pantalla actual, a partir de
 * las sedes que ya le dejaron ver (sedesVisibles, filtradas por RLS):
 * - Si solo tiene una sede visible (típico de un Chef/Lector con una
 *   sola sede asignada), esa es siempre la activa — el selector del
 *   header ni se muestra en ese caso (ver SelectorSede).
 * - Si tiene varias (Admin de marca, Admin multi-marca, o ahora también
 *   un Chef/Lector/Admin con varias sedes asignadas), se usa la que
 *   venga en el query param `?sede=` si es una de las visibles; si no
 *   hay ninguna válida, se usa la primera.
 *
 * El parámetro `usuario` ya no hace falta para esta cuenta — se deja en
 * la firma para no tener que tocar cada pantalla que la llama.
 */
export function resolverSedeActiva(
  _usuario: Pick<UsuarioActual, "sede_id">,
  sedesVisibles: SedeConMarca[],
  sedeParam: string | undefined
): SedeConMarca | null {
  if (sedesVisibles.length <= 1) {
    return sedesVisibles[0] ?? null;
  }

  if (sedeParam) {
    const encontrada = sedesVisibles.find((s) => s.id === sedeParam);
    if (encontrada) return encontrada;
  }

  return sedesVisibles[0] ?? null;
}
