"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual, esMaestro } from "@/lib/auth/usuario-actual";

/**
 * Crear, desactivar o eliminar una marca/sede es la operación más
 * delicada del sistema — de ahí cuelgan insumos, recetas, familias y
 * usuarios enteros (ver el caso real de las sedes de 123 WOK, con más de
 * 1.500 insumos cargados). Por eso, además de lo que ya impone RLS
 * (cualquier Admin), acá se exige explícitamente que sea el Admin
 * multi-marca, como pidió Mariluz.
 */
async function requireMaestro() {
  const usuario = await getUsuarioActual();
  if (!usuario || !esMaestro(usuario)) {
    throw new Error("Solo el Admin multi-marca puede crear, desactivar o eliminar marcas y sedes.");
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

/**
 * Eliminar de verdad (20/10, a pedido explícito de Mariluz): borra la
 * fila para siempre, a diferencia de "Desactivar" que siempre se puede
 * deshacer. Por eso solo se permite si la marca está vacía — sin
 * ninguna sede cargada (ni activa ni inactiva) y sin ningún Admin de
 * marca asignado todavía. Si tiene algo de eso, hay que sacarlo primero
 * o usar "Desactivar" en vez de "Eliminar", para no repetir el riesgo
 * real que vivimos con una sede de 123 WOK con más de 1.500 insumos
 * cargados.
 */
export async function eliminarMarca(formData: FormData) {
  await requireMaestro();
  const id = String(formData.get("id") ?? "");
  const nombre = String(formData.get("nombre") ?? "");
  if (!id) return;

  const supabase = createClient();

  const [sedesRes, usuariosRes] = await Promise.all([
    supabase.from("sedes").select("id", { count: "exact", head: true }).eq("marca_id", id),
    supabase
      .from("usuarios")
      .select("id", { count: "exact", head: true })
      .eq("marca_id", id)
      .is("sede_id", null),
  ]);

  const sedes = sedesRes.count ?? 0;
  const usuariosAdmin = usuariosRes.count ?? 0;

  if (sedes > 0 || usuariosAdmin > 0) {
    const detalle = [
      sedes > 0 ? `${sedes} sede(s)` : null,
      usuariosAdmin > 0 ? `${usuariosAdmin} usuario(s) admin asignado(s)` : null,
    ]
      .filter(Boolean)
      .join(" y ");
    redirect(
      `/marcas?error=${encodeURIComponent(
        `No se pudo eliminar "${nombre}": todavía tiene ${detalle}. Sacá o desactivá eso primero, o usá "Activa" en vez de "Eliminar".`
      )}`
    );
  }

  await supabase.from("marcas").delete().eq("id", id);
  redirect("/marcas");
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

/**
 * Eliminar de verdad (20/10, a pedido explícito de Mariluz): borra la
 * fila para siempre. Solo se permite si la sede está vacía — sin
 * familias, insumos, recetas, subrecetas ni usuarios cargados todavía.
 * Si tiene algo de eso, hay que usar "Desactivar" en vez de "Eliminar",
 * para no repetir el riesgo real que vivimos con una sede de 123 WOK que
 * tenía más de 1.500 insumos cargados.
 */
export async function eliminarSede(formData: FormData) {
  await requireMaestro();
  const id = String(formData.get("id") ?? "");
  const nombre = String(formData.get("nombre") ?? "");
  if (!id) return;

  const supabase = createClient();

  const [familiasRes, insumosRes, recetasRes, subrecetasRes, usuariosRes] = await Promise.all([
    supabase.from("familias").select("id", { count: "exact", head: true }).eq("sede_id", id),
    supabase.from("insumos").select("id", { count: "exact", head: true }).eq("sede_id", id),
    supabase.from("recetas").select("id", { count: "exact", head: true }).eq("sede_id", id),
    supabase.from("subrecetas").select("id", { count: "exact", head: true }).eq("sede_id", id),
    supabase.from("usuarios").select("id", { count: "exact", head: true }).eq("sede_id", id),
  ]);

  const familias = familiasRes.count ?? 0;
  const insumos = insumosRes.count ?? 0;
  const recetas = recetasRes.count ?? 0;
  const subrecetas = subrecetasRes.count ?? 0;
  const usuariosSede = usuariosRes.count ?? 0;

  const totalDatos = familias + insumos + recetas + subrecetas + usuariosSede;

  if (totalDatos > 0) {
    const detalle = [
      familias > 0 ? `${familias} familia(s)` : null,
      insumos > 0 ? `${insumos} insumo(s)` : null,
      recetas > 0 ? `${recetas} receta(s)` : null,
      subrecetas > 0 ? `${subrecetas} subreceta(s)` : null,
      usuariosSede > 0 ? `${usuariosSede} usuario(s)` : null,
    ]
      .filter(Boolean)
      .join(", ");
    redirect(
      `/marcas?error=${encodeURIComponent(
        `No se pudo eliminar "${nombre}": todavía tiene ${detalle}. Usá "Activa" para desactivarla en vez de eliminarla.`
      )}`
    );
  }

  await supabase.from("sedes").delete().eq("id", id);
  redirect("/marcas");
}
