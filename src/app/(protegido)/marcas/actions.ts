"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual, esMaestro } from "@/lib/auth/usuario-actual";

/**
 * Crear o desactivar una marca/sede es la operación más delicada del
 * sistema — de ahí cuelgan insumos, recetas, familias y usuarios enteros
 * (ver el caso real de las sedes de 123 WOK, con más de 1.500 insumos
 * cargados). Por eso, además de lo que ya impone RLS (cualquier Admin),
 * acá se exige explícitamente que sea el Admin multi-marca, como pidió
 * Mariluz.
 */
async function requireMaestro() {
  const usuario = await getUsuarioActual();
  if (!usuario || !esMaestro(usuario)) {
    throw new Error("Solo el Admin multi-marca puede crear o desactivar marcas y sedes.");
  }
}

export async function crearMarca(formData: FormData) {
  await requireMaestro();
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return;

  const supabase = createClient();
  await supabase.from("marcas").insert({ nombre });

  revalidatePath("/marcas");
}

/**
 * "Desactivar" (checkbox Activa apagado), nunca un borrado de verdad:
 * los insumos, recetas y demás datos de la marca/sede quedan intactos en
 * la base, solo se la saca de los selectores de todos los días. Mismo
 * patrón que ya usan Familias y Subfamilias.
 */
export async function actualizarMarca(formData: FormData) {
  await requireMaestro();
  const id = String(formData.get("id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!id || !nombre) return;

  const supabase = createClient();
  await supabase
    .from("marcas")
    .update({ nombre, activo: formData.get("activo") === "on" })
    .eq("id", id);

  revalidatePath("/marcas");
}

export async function crearSede(formData: FormData) {
  await requireMaestro();
  const marcaId = String(formData.get("marca_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!marcaId || !nombre) return;

  const supabase = createClient();
  await supabase.from("sedes").insert({ marca_id: marcaId, nombre });

  revalidatePath("/marcas");
}

export async function actualizarSede(formData: FormData) {
  await requireMaestro();
  const id = String(formData.get("id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!id || !nombre) return;

  const supabase = createClient();
  await supabase
    .from("sedes")
    .update({ nombre, activo: formData.get("activo") === "on" })
    .eq("id", id);

  revalidatePath("/marcas");
}
