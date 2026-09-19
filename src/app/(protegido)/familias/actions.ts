"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function textoOpcional(formData: FormData, campo: string): string | null {
  const valor = String(formData.get(campo) ?? "").trim();
  return valor || null;
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
  });

  revalidatePath("/familias");
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
      activo: formData.get("activo") === "on",
    })
    .eq("id", id);

  revalidatePath("/familias");
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
