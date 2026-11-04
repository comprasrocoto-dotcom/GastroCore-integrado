"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getUsuarioActual,
  esMaestro,
  MODULOS_DISPONIBLES,
  type Modulo,
} from "@/lib/auth/usuario-actual";

/**
 * Igual que en usuarios/actions.ts y marcas/actions.ts: además de lo que
 * ya impone RLS (cualquier rol con acceso total), acá se exige
 * explícitamente que sea el Admin multi-marca, porque los roles tocan
 * la seguridad de toda la base.
 */
async function requireMaestro() {
  const usuario = await getUsuarioActual();
  if (!usuario || !esMaestro(usuario)) {
    throw new Error("Solo el Admin multi-marca puede administrar roles.");
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

export async function crearRol(formData: FormData) {
  await requireMaestro();

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return;

  const accesoTotal = formData.get("acceso_total") === "on";
  const { modulos, area } = leerModulosYArea(formData);

  const supabase = createClient();
  const { error } = await supabase
    .from("roles")
    .insert({ nombre, es_sistema: false, acceso_total: accesoTotal, modulos, area });

  if (error) {
    const mensaje =
      error.code === "23505"
        ? `Ya existe un rol llamado "${nombre}".`
        : `No se pudo crear el rol "${nombre}": ${error.message}`;
    redirect(`/configuracion?error=${encodeURIComponent(mensaje)}`);
  }

  revalidatePath("/configuracion");
  revalidatePath("/usuarios");
}

/**
 * Los roles de sistema (Admin/Chef/Lector) no se pueden editar desde
 * acá — ni el nombre, ni si tienen acceso total, ni sus pantallas/área
 * por defecto — para que nadie rompa sin querer la seguridad de
 * siempre. Solo se pueden editar los roles creados a mano.
 */
export async function actualizarRol(formData: FormData) {
  await requireMaestro();

  const id = String(formData.get("id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!id || !nombre) return;

  const supabase = createClient();
  const { data: rolActual } = await supabase
    .from("roles")
    .select("es_sistema")
    .eq("id", id)
    .maybeSingle();

  if (!rolActual || rolActual.es_sistema) return;

  const accesoTotal = formData.get("acceso_total") === "on";
  const { modulos, area } = leerModulosYArea(formData);

  const { error } = await supabase
    .from("roles")
    .update({ nombre, acceso_total: accesoTotal, modulos, area })
    .eq("id", id);

  if (error) {
    const mensaje =
      error.code === "23505"
        ? `Ya existe un rol llamado "${nombre}".`
        : `No se pudo guardar el rol "${nombre}": ${error.message}`;
    redirect(`/configuracion?error=${encodeURIComponent(mensaje)}`);
  }

  revalidatePath("/configuracion");
  revalidatePath("/usuarios");
}

/**
 * Borra un rol creado a mano. Los de sistema están protegidos. Si todavía
 * hay algún usuario con este rol asignado, la base lo rechaza sola (hay
 * una referencia de `usuarios.rol` hacia `roles.nombre`) — acá solo se
 * da un mensaje en español en vez del error crudo de Postgres.
 */
export async function eliminarRol(formData: FormData) {
  await requireMaestro();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = createClient();
  const { data: rol } = await supabase
    .from("roles")
    .select("nombre, es_sistema")
    .eq("id", id)
    .maybeSingle();

  if (!rol || rol.es_sistema) return;

  const { error } = await supabase.from("roles").delete().eq("id", id);

  if (error) {
    redirect(
      `/configuracion?error=${encodeURIComponent(
        `No se pudo eliminar el rol "${rol.nombre}": todavía hay usuarios con ese rol asignado. Cambiales el rol primero desde Usuarios.`
      )}`
    );
  }

  revalidatePath("/configuracion");
  revalidatePath("/usuarios");
}

/**
 * Asigna un rol a uno o varios usuarios existentes de una sola vez: les
 * cambia `usuarios.rol` (esto sí es seguridad real — define si tienen
 * acceso total o no) y de paso les precarga las pantallas/área por
 * defecto del rol, igual que hacían antes las plantillas de permisos.
 * Después de aplicado, cada usuario se puede seguir ajustando a mano
 * desde Usuarios sin que eso le cambie nada al rol ni a otros usuarios.
 */
export async function aplicarRolAUsuarios(formData: FormData) {
  await requireMaestro();

  const rolId = String(formData.get("rol_id") ?? "");
  const usuarioIds = formData.getAll("usuario_ids").map(String).filter(Boolean);
  if (!rolId || usuarioIds.length === 0) return;

  const supabase = createClient();

  const { data: rol, error: errorRol } = await supabase
    .from("roles")
    .select("nombre, modulos, area")
    .eq("id", rolId)
    .single();

  if (errorRol || !rol) return;

  await supabase
    .from("usuarios")
    .update({ rol: rol.nombre, modulos: rol.modulos, area: rol.area })
    .in("id", usuarioIds);

  revalidatePath("/configuracion");
  revalidatePath("/usuarios");
}
