"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  agregarLineaIngrediente,
  eliminarLineaIngrediente,
  recalcularReceta,
} from "@/lib/data/ingredientes";
import { crearRecetaConIngredientes } from "@/lib/data/recetas";
import { registrarHistorialReceta } from "@/lib/data/historial";

export type EstadoReceta = { error: string | null };

/**
 * Crea la receta y todos sus ingredientes en un solo guardado — la usa el
 * armador de "Nueva receta" (RecetaForm), que arma la lista de
 * ingredientes en el navegador y solo al final manda todo junto, igual
 * que GastroCore.
 */
export async function crearRecetaCompleta(
  _estadoPrevio: EstadoReceta,
  formData: FormData
): Promise<EstadoReceta> {
  const sedeId = String(formData.get("sede_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!sedeId || !nombre) {
    return { error: "Falta el nombre de la receta." };
  }

  let lineas: {
    tipoItem: "insumo" | "subreceta";
    itemId: string;
    cantidad: number;
    unidadCodigo: string | null;
    mermaPct: number;
  }[] = [];
  try {
    const crudo = JSON.parse(String(formData.get("ingredientes_json") ?? "[]"));
    if (Array.isArray(crudo)) {
      lineas = crudo
        .filter((l) => l && l.itemId && Number(l.cantidad) > 0)
        .map((l) => ({
          tipoItem: l.tipoItem === "subreceta" ? "subreceta" : "insumo",
          itemId: String(l.itemId),
          cantidad: Number(l.cantidad),
          unidadCodigo: l.unidadCodigo ? String(l.unidadCodigo) : null,
          mermaPct: Number(l.mermaPct) || 0,
        }));
    }
  } catch {
    return { error: "No se pudo leer la lista de ingredientes." };
  }

  const resultado = await crearRecetaConIngredientes({
    sedeId,
    nombre,
    familiaId: String(formData.get("familia_id") ?? "") || null,
    rendimiento: Number(formData.get("rendimiento") ?? 0) || null,
    unidadRendimientoCodigo: String(formData.get("unidad_rendimiento_codigo") ?? "") || null,
    desvioPct: Number(formData.get("desvio_pct") ?? 0) / 100,
    precioReal: Number(formData.get("precio_real") ?? 0) || null,
    lineas,
  });

  if ("error" in resultado) {
    return { error: `No se pudo crear la receta: ${resultado.error}` };
  }

  await registrarHistorialReceta(resultado.id, "creacion");

  revalidatePath("/recetas");
  redirect(`/recetas/${resultado.id}?sede=${sedeId}`);
}

export async function actualizarReceta(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!id || !nombre) return;

  const supabase = createClient();
  await supabase
    .from("recetas")
    .update({
      nombre,
      familia_id: String(formData.get("familia_id") ?? "") || null,
      rendimiento: Number(formData.get("rendimiento") ?? 0) || null,
      unidad_rendimiento_codigo:
        String(formData.get("unidad_rendimiento_codigo") ?? "") || null,
      precio_real: Number(formData.get("precio_real") ?? 0) || null,
      iva: Number(formData.get("iva") ?? 8) / 100,
      merma_pct: Number(formData.get("merma_pct") ?? 0) / 100,
      desvio_pct: Number(formData.get("desvio_pct") ?? 0) / 100,
      activo: formData.get("activo") === "on",
    })
    .eq("id", id);

  await recalcularReceta(id);
  await registrarHistorialReceta(id, "edicion");
  revalidatePath(`/recetas/${id}`);
}

export async function agregarIngredienteReceta(formData: FormData) {
  const recetaId = String(formData.get("receta_id") ?? "");
  const sedeId = String(formData.get("sede_id") ?? "");
  const tipoItem = String(formData.get("tipo_item") ?? "insumo") as "insumo" | "subreceta";
  const cantidad = Number(formData.get("cantidad") ?? 0);
  if (!recetaId || !cantidad) return;

  await agregarLineaIngrediente({
    sedeId,
    recetaId,
    tipoItem,
    insumoId: tipoItem === "insumo" ? String(formData.get("insumo_id") ?? "") : undefined,
    subrecetaId:
      tipoItem === "subreceta" ? String(formData.get("subreceta_ref_id") ?? "") : undefined,
    cantidad,
    unidadCodigo: String(formData.get("unidad_codigo") ?? "") || null,
    mermaPct: Number(formData.get("merma_pct") ?? 0) / 100,
    orden: Number(formData.get("orden") ?? 0),
  });

  await recalcularReceta(recetaId);
  await registrarHistorialReceta(recetaId, "ingredientes");
  revalidatePath(`/recetas/${recetaId}`);
}

export async function eliminarIngredienteReceta(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const recetaId = String(formData.get("receta_id") ?? "");
  if (!id || !recetaId) return;

  await eliminarLineaIngrediente(id);
  await recalcularReceta(recetaId);
  await registrarHistorialReceta(recetaId, "ingredientes");
  revalidatePath(`/recetas/${recetaId}`);
}

export async function guardarFicha(formData: FormData) {
  const recetaId = String(formData.get("receta_id") ?? "");
  if (!recetaId) return;

  const supabase = createClient();
  await supabase.from("fichas_tecnicas").upsert(
    {
      receta_id: recetaId,
      sede_id: String(formData.get("sede_id") ?? ""),
      preparacion: String(formData.get("preparacion") ?? "").trim() || null,
      emplatado: String(formData.get("emplatado") ?? "").trim() || null,
      notas: String(formData.get("notas") ?? "").trim() || null,
      tiempo_min: Number(formData.get("tiempo_min") ?? 0) || null,
      gramaje_porcion: Number(formData.get("gramaje_porcion") ?? 0) || null,
    },
    { onConflict: "receta_id" }
  );

  await registrarHistorialReceta(recetaId, "ficha_tecnica");
  revalidatePath(`/recetas/${recetaId}`);
}
