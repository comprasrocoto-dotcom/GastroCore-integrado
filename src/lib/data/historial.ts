import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";

/**
 * Guarda una "foto" (snapshot) de la receta completa — datos generales,
 * ingredientes y ficha técnica — en historial_recetas, con un número de
 * versión que sube de a uno. Sirve para poder ver cómo era la receta (y su
 * costo) en el pasado, no solo el precio (eso ya lo cubre
 * precios_historicos a nivel de insumo).
 */
export async function registrarHistorialReceta(
  recetaId: string,
  accion: string
) {
  const supabase = createClient();
  const usuario = await getUsuarioActual();

  const [{ data: receta }, { data: ingredientes }, { data: ficha }, { data: ultimo }] =
    await Promise.all([
      supabase.from("recetas").select("*").eq("id", recetaId).single(),
      supabase.from("ingredientes_receta").select("*").eq("receta_id", recetaId),
      supabase.from("fichas_tecnicas").select("*").eq("receta_id", recetaId).maybeSingle(),
      supabase
        .from("historial_recetas")
        .select("version")
        .eq("receta_id", recetaId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (!receta) return;

  const siguienteVersion = (ultimo?.version ?? 0) + 1;

  await supabase.from("historial_recetas").insert({
    sede_id: receta.sede_id,
    receta_id: recetaId,
    accion,
    usuario_id: usuario?.id ?? null,
    version: siguienteVersion,
    snapshot: { receta, ingredientes: ingredientes ?? [], ficha: ficha ?? null },
  });
}

export async function listarHistorialReceta(recetaId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("historial_recetas")
    .select("id, accion, version, fecha, snapshot, usuarios(nombre)")
    .eq("receta_id", recetaId)
    .order("version", { ascending: false })
    .limit(30);

  if (error || !data) return [];
  return data.map((h) => ({
    id: h.id as string,
    accion: h.accion as string | null,
    version: h.version as number,
    fecha: h.fecha as string,
    usuario_nombre: (h.usuarios as unknown as { nombre: string } | null)?.nombre ?? null,
    snapshot: h.snapshot as {
      receta: { costo_porcion: number; precio_real: number | null };
    } | null,
  }));
}
