"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { obtenerInsumo } from "@/lib/data/insumos";

export type EstadoInsumo = { error: string | null };

function leerNumero(formData: FormData, campo: string): number {
  const valor = Number(formData.get(campo));
  return Number.isFinite(valor) ? valor : 0;
}

export async function crearInsumo(
  _estadoPrevio: EstadoInsumo,
  formData: FormData
): Promise<EstadoInsumo> {
  const sedeId = String(formData.get("sede_id") ?? "");
  const articulo = String(formData.get("articulo") ?? "").trim();

  if (!sedeId || !articulo) {
    return { error: "Falta la sede o el nombre del artículo." };
  }

  const supabase = createClient();
  const { error } = await supabase.from("insumos").insert({
    sede_id: sedeId,
    articulo,
    subarticulo: String(formData.get("subarticulo") ?? "").trim() || null,
    subfamilia_id: String(formData.get("subfamilia_id") ?? "") || null,
    unidad_codigo: String(formData.get("unidad_codigo") ?? "") || null,
    coste: leerNumero(formData, "coste"),
    referencia: String(formData.get("referencia") ?? "").trim() || null,
  });

  if (error) {
    return { error: `No se pudo crear el insumo: ${error.message}` };
  }

  revalidatePath("/insumos");
  redirect(`/insumos?sede=${sedeId}`);
}

export async function actualizarInsumo(
  _estadoPrevio: EstadoInsumo,
  formData: FormData
): Promise<EstadoInsumo> {
  const id = String(formData.get("id") ?? "");
  const sedeId = String(formData.get("sede_id") ?? "");
  const articulo = String(formData.get("articulo") ?? "").trim();
  const nuevoCoste = leerNumero(formData, "coste");
  const motivo = String(formData.get("motivo") ?? "").trim() || null;

  if (!id || !articulo) {
    return { error: "Falta el nombre del artículo." };
  }

  const supabase = createClient();
  const usuario = await getUsuarioActual();
  const insumoActual = await obtenerInsumo(id);

  const { error } = await supabase
    .from("insumos")
    .update({
      articulo,
      subarticulo: String(formData.get("subarticulo") ?? "").trim() || null,
      subfamilia_id: String(formData.get("subfamilia_id") ?? "") || null,
      unidad_codigo: String(formData.get("unidad_codigo") ?? "") || null,
      coste: nuevoCoste,
      referencia: String(formData.get("referencia") ?? "").trim() || null,
      activo: formData.get("activo") === "on",
    })
    .eq("id", id);

  if (error) {
    return { error: `No se pudo guardar: ${error.message}` };
  }

  // Si cambió el costo, dejamos registro en precios_historicos — igual que
  // hacía GastroCore, para poder ver la evolución de precio de cada insumo.
  if (insumoActual && insumoActual.coste !== nuevoCoste) {
    await supabase.from("precios_historicos").insert({
      sede_id: sedeId || insumoActual.sede_id,
      insumo_id: id,
      coste: nuevoCoste,
      coste_anterior: insumoActual.coste,
      diferencia: nuevoCoste - insumoActual.coste,
      motivo,
      usuario_id: usuario?.id ?? null,
    });
  }

  revalidatePath("/insumos");
  redirect(`/insumos?sede=${sedeId}`);
}

/**
 * Eliminar de verdad (06/11, a pedido explícito de Mariluz): borra la
 * fila para siempre, a diferencia de "Activo" que siempre se puede
 * deshacer. Mismo patrón que ya se usa para Marcas y Sedes (20/10): solo
 * se permite si el insumo no está cargado como ingrediente de ninguna
 * receta/subreceta, ni es el insumo maestro de ninguna subreceta. Si lo
 * está, hay que sacarlo de ahí primero o usar "Activo" en vez de
 * "Eliminar" — para no romper ningún costo ya calculado. El historial de
 * precios de este insumo (`precios_historicos`) se borra junto con él
 * automáticamente (son solo números viejos de ESTE insumo, no datos
 * compartidos con nada más).
 */
export async function eliminarInsumo(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nombre = String(formData.get("nombre") ?? "");
  const sedeId = String(formData.get("sede_id") ?? "");
  if (!id) return;

  const supabase = createClient();

  const [ingredientesRes, subrecetasRes] = await Promise.all([
    supabase.from("ingredientes_receta").select("id", { count: "exact", head: true }).eq("insumo_id", id),
    supabase.from("subrecetas").select("id", { count: "exact", head: true }).eq("insumo_id", id),
  ]);

  const enIngredientes = ingredientesRes.count ?? 0;
  const comoMaestro = subrecetasRes.count ?? 0;

  if (enIngredientes > 0 || comoMaestro > 0) {
    const detalle = [
      enIngredientes > 0 ? `usado en ${enIngredientes} ingrediente(s) de receta/subreceta` : null,
      comoMaestro > 0 ? `es el insumo maestro de ${comoMaestro} subreceta(s)` : null,
    ]
      .filter(Boolean)
      .join(" y ");
    redirect(
      `/insumos?sede=${sedeId}&error=${encodeURIComponent(
        `No se pudo eliminar "${nombre}": está ${detalle}. Sacalo de ahí primero, o usá "Activo" en vez de "Eliminar".`
      )}`
    );
  }

  await supabase.from("insumos").delete().eq("id", id);
  revalidatePath("/insumos");
  redirect(`/insumos?sede=${sedeId}`);
}
