"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { crearRecetaConIngredientes, actualizarRecetaConIngredientes } from "@/lib/data/recetas";
import { registrarHistorialReceta } from "@/lib/data/historial";

export type EstadoReceta = { error: string | null };

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

  const lineas = parsearLineas(formData);
  if (lineas === null) {
    return { error: "No se pudo leer la lista de ingredientes." };
  }

  const resultado = await crearRecetaConIngredientes({
    sedeId,
    nombre,
    familiaId: String(formData.get("familia_id") ?? "") || null,
    subfamiliaId: null,
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

/**
 * Actualiza una receta existente y reemplaza toda su lista de
 * ingredientes — usa la misma pantalla "Nueva receta" (RecetaForm) que la
 * creación, tal como hace GastroCore reutilizando /recetas/nueva?edit=ID
 * en vez de tener un formulario de edición aparte.
 */
export async function actualizarRecetaCompleta(
  _estadoPrevio: EstadoReceta,
  formData: FormData
): Promise<EstadoReceta> {
  const id = String(formData.get("id") ?? "");
  const sedeId = String(formData.get("sede_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!id || !sedeId || !nombre) {
    return { error: "Falta el nombre de la receta." };
  }

  const lineas = parsearLineas(formData);
  if (lineas === null) {
    return { error: "No se pudo leer la lista de ingredientes." };
  }

  const resultado = await actualizarRecetaConIngredientes({
    id,
    sedeId,
    nombre,
    familiaId: String(formData.get("familia_id") ?? "") || null,
    rendimiento: Number(formData.get("rendimiento") ?? 0) || null,
    unidadRendimientoCodigo: String(formData.get("unidad_rendimiento_codigo") ?? "") || null,
    desvioPct: Number(formData.get("desvio_pct") ?? 0) / 100,
    precioReal: Number(formData.get("precio_real") ?? 0) || null,
    lineas,
  });

  if (resultado && "error" in resultado) {
    return { error: `No se pudo actualizar la receta: ${resultado.error}` };
  }

  await registrarHistorialReceta(id, "edicion");

  revalidatePath("/recetas");
  revalidatePath(`/recetas/${id}`);
  redirect(`/recetas/${id}?sede=${sedeId}`);
}

/**
 * Guarda solo la foto de la receta en `fichas_tecnicas.foto_url` — la usa
 * el botón "Subir foto" (SubidaFoto) en la vista de detalle, sin tocar el
 * resto de la ficha técnica.
 */
export async function actualizarFotoReceta(recetaId: string, sedeId: string, url: string) {
  if (!recetaId || !sedeId) return;

  const supabase = createClient();
  await supabase.from("fichas_tecnicas").upsert(
    { receta_id: recetaId, sede_id: sedeId, foto_url: url },
    { onConflict: "receta_id" }
  );

  revalidatePath(`/recetas/${recetaId}`);
  revalidatePath("/recetario");
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
