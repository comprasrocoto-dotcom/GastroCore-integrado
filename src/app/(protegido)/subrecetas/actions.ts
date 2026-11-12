"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  crearSubrecetaConIngredientes,
  actualizarSubrecetaConIngredientes,
} from "@/lib/data/subrecetas";
import { registrarHistorialSubreceta } from "@/lib/data/historial-subrecetas";

export type EstadoSubreceta = { error: string | null };

function parsearLineas(formData: FormData):
  | {
      tipoItem: "insumo" | "subreceta";
      itemId: string;
      cantidad: number;
      unidadCodigo: string | null;
      mermaPct: number;
    }[]
  | null {
  try {
    const crudo = JSON.parse(String(formData.get("ingredientes_json") ?? "[]"));
    if (!Array.isArray(crudo)) return [];
    return crudo
      .filter((l) => l && l.itemId && Number(l.cantidad) > 0)
      .map((l) => ({
        tipoItem: l.tipoItem === "subreceta" ? "subreceta" : "insumo",
        itemId: String(l.itemId),
        cantidad: Number(l.cantidad),
        unidadCodigo: l.unidadCodigo ? String(l.unidadCodigo) : null,
        mermaPct: Number(l.mermaPct) || 0,
      }));
  } catch {
    return null;
  }
}

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

  const lineas = parsearLineas(formData);
  if (lineas === null) {
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

  await registrarHistorialSubreceta(resultado.id, "creacion");

  revalidatePath("/subrecetas");
  redirect(`/subrecetas/${resultado.id}?sede=${sedeId}`);
}

/**
 * Actualiza una subreceta existente y reemplaza toda su lista de
 * ingredientes — usa la misma pantalla "Nueva subreceta" (SubrecetaForm)
 * que la creación, igual formato que Recetas (`/subrecetas/nueva?edit=ID`
 * en vez de la pantalla simple que había antes). No toca CUÁL es el
 * insumo maestro vinculado — eso se define una sola vez, al crear. Sí
 * puede cambiar la subfamilia de ese maestro (12/11, pedido de Mariluz;
 * ver `actualizarSubrecetaConIngredientes`).
 */
export async function actualizarSubrecetaCompleta(
  _estadoPrevio: EstadoSubreceta,
  formData: FormData
): Promise<EstadoSubreceta> {
  const id = String(formData.get("id") ?? "");
  const sedeId = String(formData.get("sede_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!id || !sedeId || !nombre) {
    return { error: "Falta el nombre de la subreceta." };
  }

  const lineas = parsearLineas(formData);
  if (lineas === null) {
    return { error: "No se pudo leer la lista de ingredientes." };
  }

  const resultado = await actualizarSubrecetaConIngredientes({
    id,
    sedeId,
    nombre,
    rendimiento: Number(formData.get("rendimiento") ?? 0) || null,
    unidadRendimientoCodigo: String(formData.get("unidad_rendimiento_codigo") ?? "") || null,
    desvioPct: Number(formData.get("desvio_pct") ?? 0) / 100,
    subfamiliaId: String(formData.get("subfamilia_id") ?? "") || null,
    lineas,
  });

  if ("error" in resultado) {
    return { error: `No se pudo actualizar la subreceta: ${resultado.error}` };
  }

  await registrarHistorialSubreceta(id, "edicion");

  revalidatePath("/subrecetas");
  revalidatePath(`/subrecetas/${id}`);
  redirect(`/subrecetas/${id}?sede=${sedeId}`);
}

/**
 * Guarda solo la foto de la subreceta en `subrecetas.foto_url` — la usa el
 * botón "Subir foto" (SubidaFoto) en la vista de detalle.
 */
export async function actualizarFotoSubreceta(subrecetaId: string, url: string) {
  if (!subrecetaId) return;

  const supabase = createClient();
  await supabase.from("subrecetas").update({ foto_url: url }).eq("id", subrecetaId);

  revalidatePath(`/subrecetas/${subrecetaId}`);
  revalidatePath("/recetario");
}

/**
 * Guarda la ficha técnica de la subreceta (tiempo de preparación, gramaje,
 * preparación, emplatado, notas) — mismo patrón que `guardarFicha`
 * (recetas/actions.ts), pero en `fichas_tecnicas_subreceta`.
 */
export async function guardarFichaSubreceta(formData: FormData) {
  const subrecetaId = String(formData.get("subreceta_id") ?? "");
  if (!subrecetaId) return;

  const supabase = createClient();
  await supabase.from("fichas_tecnicas_subreceta").upsert(
    {
      subreceta_id: subrecetaId,
      sede_id: String(formData.get("sede_id") ?? ""),
      preparacion: String(formData.get("preparacion") ?? "").trim() || null,
      emplatado: String(formData.get("emplatado") ?? "").trim() || null,
      notas: String(formData.get("notas") ?? "").trim() || null,
      tiempo_min: Number(formData.get("tiempo_min") ?? 0) || null,
      gramaje_porcion: Number(formData.get("gramaje_porcion") ?? 0) || null,
    },
    { onConflict: "subreceta_id" }
  );

  await registrarHistorialSubreceta(subrecetaId, "ficha_tecnica");
  revalidatePath(`/subrecetas/${subrecetaId}`);
}
