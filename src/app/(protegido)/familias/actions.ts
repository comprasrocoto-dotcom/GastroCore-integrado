"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function textoOpcional(formData: FormData, campo: string): string | null {
  const valor = String(formData.get(campo) ?? "").trim();
  return valor || null;
}

/**
 * Food cost objetivo propio de una familia, como porcentaje (0-100) en el
 * campo del formulario. Vacío = `null` = esta familia usa el food cost
 * objetivo general de Configuración, igual que siempre. Se guarda como
 * fracción (ej. 40 → 0.4), igual que `guardarConfiguracion` en
 * Configuración.
 */
function fcObjetivoOpcional(formData: FormData): number | null {
  const valor = String(formData.get("fc_objetivo") ?? "").trim();
  if (!valor) return null;
  const pct = Number(valor);
  if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) return null;
  return pct / 100;
}

export async function crearFamilia(formData: FormData) {
  const sedeId = String(formData.get("sede_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!sedeId || !nombre) return;

  const supabase = createClient();
  await supabase.from("familias").insert({
    sede_id: sedeId,
    nombre,
    tipo: textoOpcional(formData, "tipo"),
    centrocosto: textoOpcional(formData, "centrocosto"),
    fc_objetivo: fcObjetivoOpcional(formData),
  });

  revalidatePath("/familias");
  revalidatePath("/recetas");
}

export async function actualizarFamilia(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!id || !nombre) return;

  const supabase = createClient();
  await supabase
    .from("familias")
    .update({
      nombre,
      tipo: textoOpcional(formData, "tipo"),
      centrocosto: textoOpcional(formData, "centrocosto"),
      fc_objetivo: fcObjetivoOpcional(formData),
      activo: formData.get("activo") === "on",
    })
    .eq("id", id);

  revalidatePath("/familias");
  revalidatePath("/recetas");
}

/**
 * Atajo para cambiar solo el campo "Área (Recetario)" de una familia,
 * sin tocar nombre/tipo/food cost objetivo/activo — lo usa la tarjeta
 * "Centros de costo" en Configuración (27/10), que muestra todas las
 * familias de la sede activa en una lista más corta que la pantalla
 * completa de Familias, para cambiar esto rápido sin scrollear.
 */
export async function actualizarCentroCostoFamilia(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = createClient();
  await supabase
    .from("familias")
    .update({ centrocosto: textoOpcional(formData, "centrocosto") })
    .eq("id", id);

  revalidatePath("/familias");
  revalidatePath("/recetas");
  revalidatePath("/configuracion");
}

export async function crearSubfamilia(formData: FormData) {
  const sedeId = String(formData.get("sede_id") ?? "");
  const familiaId = String(formData.get("familia_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!sedeId || !familiaId || !nombre) return;

  const supabase = createClient();
  await supabase.from("subfamilias").insert({
    sede_id: sedeId,
    familia_id: familiaId,
    nombre,
    tipo: textoOpcional(formData, "tipo"),
    centrocosto: textoOpcional(formData, "centrocosto"),
  });

  revalidatePath("/familias");
}

export async function actualizarSubfamilia(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!id || !nombre) return;

  const supabase = createClient();
  await supabase
    .from("subfamilias")
    .update({
      nombre,
      tipo: textoOpcional(formData, "tipo"),
      centrocosto: textoOpcional(formData, "centrocosto"),
      activo: formData.get("activo") === "on",
    })
    .eq("id", id);

  revalidatePath("/familias");
}
