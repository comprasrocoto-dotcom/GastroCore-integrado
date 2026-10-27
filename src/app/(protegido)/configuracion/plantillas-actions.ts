"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getUsuarioActual,
  esMaestro,
  MODULOS_DISPONIBLES,
  type Modulo,
} from "@/lib/auth/usuario-actual";

/**
 * Igual que en usuarios/actions.ts y marcas/actions.ts: además de lo que
 * ya impone RLS (cualquier Admin), acá se exige explícitamente que sea
 * el Admin multi-marca, porque estas plantillas después se usan para
 * tocar los permisos de otros usuarios.
 */
async function requireMaestro() {
  const usuario = await getUsuarioActual();
  if (!usuario || !esMaestro(usuario)) {
    throw new Error("Solo el Admin multi-marca puede administrar plantillas de permisos.");
  }
  return usuario;
}

function leerModulosYArea(formData: FormData): {
  modulos: Modulo[] | null;
  area: "BAR" | "COCINA" | null;
} {
  const sinRestricciones = formData.get("sin_restricciones_modulos") === "on";
  const modulos = sinRestricciones
    ? null
    : formData
        .getAll("modulos")
        .map(String)
        .filter((m): m is Modulo => (MODULOS_DISPONIBLES as readonly string[]).includes(m));

  const areaRaw = String(formData.get("area") ?? "");
  const area = areaRaw === "BAR" || areaRaw === "COCINA" ? areaRaw : null;

  return { modulos, area };
}

export async function crearPlantilla(formData: FormData) {
  await requireMaestro();

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return;

  const { modulos, area } = leerModulosYArea(formData);

  const supabase = createClient();
  await supabase.from("plantillas_permisos").insert({ nombre, modulos, area });

  revalidatePath("/configuracion");
}

export async function actualizarPlantilla(formData: FormData) {
  await requireMaestro();

  const id = String(formData.get("id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!id || !nombre) return;

  const { modulos, area } = leerModulosYArea(formData);

  const supabase = createClient();
  await supabase.from("plantillas_permisos").update({ nombre, modulos, area }).eq("id", id);

  revalidatePath("/configuracion");
}

/**
 * Eliminar una plantilla sí borra la fila de verdad (a diferencia de
 * marcas/sedes, acá no hace falta "desactivar"): una plantilla es solo
 * un atajo para no repetir checkboxes, no tiene ningún dato real
 * colgando — borrarla no afecta a los usuarios que ya la usaron antes,
 * porque lo que importa es lo que haya quedado guardado en
 * `usuarios.modulos`/`usuarios.area`, no un vínculo con la plantilla.
 */
export async function eliminarPlantilla(formData: FormData) {
  await requireMaestro();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = createClient();
  await supabase.from("plantillas_permisos").delete().eq("id", id);

  revalidatePath("/configuracion");
}

/**
 * Copia los módulos y el área de una plantilla a uno o varios usuarios
 * existentes de una sola vez — sin crear ningún vínculo permanente con
 * la plantilla: si después se edita o se borra la plantilla, los
 * usuarios que ya la recibieron no cambian, porque lo que importa es lo
 * que haya quedado guardado en su propia fila.
 */
export async function aplicarPlantillaAUsuarios(formData: FormData) {
  await requireMaestro();

  const plantillaId = String(formData.get("plantilla_id") ?? "");
  const usuarioIds = formData.getAll("usuario_ids").map(String).filter(Boolean);
  if (!plantillaId || usuarioIds.length === 0) return;

  const supabase = createClient();

  const { data: plantilla, error: errorPlantilla } = await supabase
    .from("plantillas_permisos")
    .select("modulos, area")
    .eq("id", plantillaId)
    .single();

  if (errorPlantilla || !plantilla) return;

  await supabase
    .from("usuarios")
    .update({ modulos: plantilla.modulos, area: plantilla.area })
    .in("id", usuarioIds);

  revalidatePath("/configuracion");
  revalidatePath("/usuarios");
}
