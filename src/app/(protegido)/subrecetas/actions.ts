"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  agregarLineaIngrediente,
  eliminarLineaIngrediente,
  recalcularSubreceta,
} from "@/lib/data/ingredientes";

export type EstadoSubreceta = { error: string | null };

export async function crearSubreceta(
  _estadoPrevio: EstadoSubreceta,
  formData: FormData
): Promise<EstadoSubreceta> {
  const sedeId = String(formData.get("sede_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const rendimiento = Number(formData.get("rendimiento") ?? 0) || null;
  const unidad = String(formData.get("unidad_rendimiento_codigo") ?? "") || null;

  if (!sedeId || !nombre) {
    return { error: "Falta el nombre de la subreceta." };
  }

  const supabase = createClient();

  // Patrón maestro-calculadora: toda subreceta vive también como un
  // insumo normal (prefijo SUB.) para poder usarse dentro de otras
  // recetas — este insumo es su "reflejo", su costo se actualiza solo
  // cada vez que se recalcula la subreceta.
  const { data: insumo, error: errorInsumo } = await supabase
    .from("insumos")
    .insert({ sede_id: sedeId, articulo: `SUB.${nombre.toUpperCase()}`, coste: 0 })
    .select("id")
    .single();

  if (errorInsumo || !insumo) {
    return { error: `No se pudo crear el insumo maestro: ${errorInsumo?.message}` };
  }

  const { data: subreceta, error: errorSub } = await supabase
    .from("subrecetas")
    .insert({
      sede_id: sedeId,
      insumo_id: insumo.id,
      nombre,
      rendimiento,
      unidad_rendimiento_codigo: unidad,
    })
    .select("id")
    .single();

  if (errorSub || !subreceta) {
    return { error: `No se pudo crear la subreceta: ${errorSub?.message}` };
  }

  revalidatePath("/subrecetas");
  redirect(`/subrecetas/${subreceta.id}?sede=${sedeId}`);
}

export async function actualizarSubreceta(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!id || !nombre) return;

  const supabase = createClient();
  await supabase
    .from("subrecetas")
    .update({
      nombre,
      rendimiento: Number(formData.get("rendimiento") ?? 0) || null,
      unidad_rendimiento_codigo:
        String(formData.get("unidad_rendimiento_codigo") ?? "") || null,
      merma_pct: Number(formData.get("merma_pct") ?? 0) / 100,
      desvio_pct: Number(formData.get("desvio_pct") ?? 0) / 100,
      activo: formData.get("activo") === "on",
    })
    .eq("id", id);

  await recalcularSubreceta(id);
  revalidatePath(`/subrecetas/${id}`);
}

export async function agregarIngredienteSubreceta(formData: FormData) {
  const subrecetaId = String(formData.get("subreceta_id") ?? "");
  const sedeId = String(formData.get("sede_id") ?? "");
  const tipoItem = String(formData.get("tipo_item") ?? "insumo") as "insumo" | "subreceta";
  const cantidad = Number(formData.get("cantidad") ?? 0);
  if (!subrecetaId || !cantidad) return;

  await agregarLineaIngrediente({
    sedeId,
    subrecetaDuenaId: subrecetaId,
    tipoItem,
    insumoId: tipoItem === "insumo" ? String(formData.get("insumo_id") ?? "") : undefined,
    subrecetaId: tipoItem === "subreceta" ? String(formData.get("subreceta_ref_id") ?? "") : undefined,
    cantidad,
    unidadCodigo: String(formData.get("unidad_codigo") ?? "") || null,
    mermaPct: Number(formData.get("merma_pct") ?? 0) / 100,
    orden: Number(formData.get("orden") ?? 0),
  });

  await recalcularSubreceta(subrecetaId);
  revalidatePath(`/subrecetas/${subrecetaId}`);
}

export async function eliminarIngredienteSubreceta(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const subrecetaId = String(formData.get("subreceta_id") ?? "");
  if (!id || !subrecetaId) return;

  await eliminarLineaIngrediente(id);
  await recalcularSubreceta(subrecetaId);
  revalidatePath(`/subrecetas/${subrecetaId}`);
}
