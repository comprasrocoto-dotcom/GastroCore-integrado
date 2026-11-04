import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";

/**
 * Guarda una "foto" (snapshot) de la subreceta completa — datos generales,
 * ingredientes y ficha técnica — en `historial_subrecetas`, con un número
 * de versión que sube de a uno. Mismo patrón que
 * `registrarHistorialReceta` (lib/data/historial.ts), pero para
 * Subrecetas.
 */
export async function registrarHistorialSubreceta(subrecetaId: string, accion: string) {
  const supabase = createClient();
  const usuario = await getUsuarioActual();

  const [{ data: subreceta }, { data: ingredientes }, { data: ficha }, { data: ultimo }] =
    await Promise.all([
      supabase.from("subrecetas").select("*").eq("id", subrecetaId).single(),
      supabase.from("ingredientes_receta").select("*").eq("subreceta_duena_id", subrecetaId),
      supabase
        .from("fichas_tecnicas_subreceta")
        .select("*")
        .eq("subreceta_id", subrecetaId)
        .maybeSingle(),
      supabase
        .from("historial_subrecetas")
        .select("version")
        .eq("subreceta_id", subrecetaId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (!subreceta) return;

  const siguienteVersion = (ultimo?.version ?? 0) + 1;

  await supabase.from("historial_subrecetas").insert({
    sede_id: subreceta.sede_id,
    subreceta_id: subrecetaId,
    accion,
    usuario_id: usuario?.id ?? null,
    version: siguienteVersion,
    snapshot: { subreceta, ingredientes: ingredientes ?? [], ficha: ficha ?? null },
  });
}

export async function listarHistorialSubreceta(subrecetaId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("historial_subrecetas")
    .select("id, accion, version, fecha, snapshot, usuarios(nombre)")
    .eq("subreceta_id", subrecetaId)
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
      subreceta: { costo_unitario: number };
    } | null,
  }));
}
