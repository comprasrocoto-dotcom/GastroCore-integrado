"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  agregarLineaIngrediente,
  eliminarLineaIngrediente,
  recalcularSubreceta,
} from "@/lib/data/ingredientes";
import { crearSubrecetaConIngredientes } from "@/lib/data/subrecetas";

export type EstadoSubreceta = { error: string | null };

/**
 * Crea la subreceta, resuelve su insumo maestro (vincula uno "SUB." sin
 * usar o crea uno nuevo) y guarda todos sus ingredientes en un solo paso —
 * la usa el armador de "Nueva subreceta" (SubrecetaForm), que arma la
 * lista de ingredientes en el navegador y solo al final manda todo junto,
 * igual que GastroCore.
 */
export async function crearSubrecetaCompleta(
  _estadoPrevio: EstadoSubreceta,
  formData: FormData
): Promise<EstadoSubreceta> {
  const sedeId = String(formData.get("sede_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!sedeId || !nombre) {
    return { error: "Falta el nombre de la subreceta." };
  }

  const modo = String(formData.get("modo") ?? "crear") === "vincular" ? "vincular" : "crear";
  const insumoVinculadoId = String(formData.get("insumo_vinculado_id") ?? "");
  if (modo === "vincular" && !insumoVinculadoId) {
    return { error: 'Elegí el insumo "SUB." a vincular, o completá los datos para crear uno nuevo.' };
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

  const resultado = await crearSubrecetaConIngredientes({
    sedeId,
    nombre,
    rendimiento: Number(formData.get("rendimiento") ?? 0) || null,
    unidadRendimientoCodigo: String(formData.get("unidad_rendimiento_codigo") ?? "") || null,
    desvioPct: Number(formData.get("desvio_pct") ?? 0) / 100,
    maestro:
      modo === "vincular"
        ? { modo: "vincular", insumoId: insumoVinculadoId }
        : {
            modo: "crear",
            referencia: String(formData.get("referencia") ?? "").trim() || null,
            subfamiliaId: String(formData.get("subfamilia_id") ?? "") || null,
          },
    lineas,
  });

  if ("error" in resultado) {
    return { error: resultado.error };
  }

  revalidatePath("/subrecetas");
  redirect(`/subrecetas/${resultado.id}?sede=${sedeId}`);
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
