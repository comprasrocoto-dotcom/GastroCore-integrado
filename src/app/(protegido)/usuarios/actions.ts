"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUsuarioActual, esMaestro, type Rol } from "@/lib/auth/usuario-actual";

export type EstadoUsuario = { error: string | null };

/**
 * Crear o desactivar usuarios es, junto con Marcas y sedes, la operación
 * más delicada del sistema — define quién puede entrar y qué puede ver.
 * Por eso, además de lo que ya impone RLS (cualquier Admin), acá se
 * exige explícitamente que sea el Admin multi-marca.
 */
async function requireMaestro() {
  const usuario = await getUsuarioActual();
  if (!usuario || !esMaestro(usuario)) {
    throw new Error("Solo el Admin multi-marca puede administrar usuarios.");
  }
  return usuario;
}

const ROLES_VALIDOS: Rol[] = ["Admin", "Chef", "Lector"];

export async function crearUsuario(
  _estadoPrevio: EstadoUsuario,
  formData: FormData
): Promise<EstadoUsuario> {
  await requireMaestro();

  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const rol = String(formData.get("rol") ?? "") as Rol;
  // "todas" (Admin multi-marca), "marca" (Admin de una marca) o "sede"
  // (una o varias sedes puntuales — Chef y Lector siempre caen acá) —
  // ver RecetaForm/Familias para el mismo patrón de alcance explícito en
  // vez de adivinar por los campos.
  const alcance = String(formData.get("alcance") ?? "");
  const marcaId = String(formData.get("marca_id") ?? "") || null;
  // Antes era un solo "sede_id"; ahora el formulario manda uno o varios
  // checkboxes con el mismo name="sede_ids", así que FormData trae una
  // entrada por cada sede marcada.
  const sedeIds = formData.getAll("sede_ids").map(String).filter(Boolean);

  if (!nombre || !email || !password) {
    return { error: "Faltan datos: nombre, correo y contraseña son obligatorios." };
  }
  if (password.length < 8) {
    return { error: "La contraseña tiene que tener al menos 8 caracteres." };
  }
  if (!ROLES_VALIDOS.includes(rol)) {
    return { error: "Elegí un rol válido." };
  }
  if (alcance === "sede" && sedeIds.length === 0) {
    return { error: "Elegí al menos una sede para este usuario." };
  }
  if (alcance === "marca" && !marcaId) {
    return { error: "Elegí a qué marca pertenece este usuario." };
  }
  if (rol !== "Admin" && alcance !== "sede") {
    return { error: "Chef y Lector tienen que estar asignados a una o varias sedes puntuales." };
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "No se pudo preparar la creación del usuario.",
    };
  }

  const { data: nuevo, error: errorAuth } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (errorAuth || !nuevo?.user) {
    return { error: `No se pudo crear la cuenta: ${errorAuth?.message ?? "error desconocido"}` };
  }

  const { error: errorFila } = await adminClient.from("usuarios").insert({
    id: nuevo.user.id,
    email,
    nombre,
    rol,
    marca_id: alcance === "marca" ? marcaId : null,
    // La sede (o sedes) puntuales ya no se guardan acá — ver
    // usuario_sedes más abajo. Esta columna queda en null para el caso
    // "sede" (se mantiene por compatibilidad con datos viejos, pero deja
    // de ser la fuente de verdad para el permiso).
    sede_id: null,
    activo: true,
  });

  if (errorFila) {
    // La cuenta de Auth ya se creó pero la fila de permisos falló — se
    // borra la cuenta de Auth para no dejar un usuario fantasma que
    // pueda iniciar sesión sin ningún permiso definido.
    await adminClient.auth.admin.deleteUser(nuevo.user.id);
    return { error: `No se pudo guardar el usuario: ${errorFila.message}` };
  }

  if (alcance === "sede" && sedeIds.length > 0) {
    const { error: errorSedes } = await adminClient
      .from("usuario_sedes")
      .insert(sedeIds.map((sedeId) => ({ usuario_id: nuevo.user.id, sede_id: sedeId })));

    if (errorSedes) {
      // Mismo criterio que arriba: si no se pudo guardar a qué sedes
      // tiene acceso, no dejamos una cuenta a medio configurar dando
      // vueltas — se borra todo y se avisa con claridad.
      await adminClient.from("usuarios").delete().eq("id", nuevo.user.id);
      await adminClient.auth.admin.deleteUser(nuevo.user.id);
      return { error: `No se pudieron guardar las sedes: ${errorSedes.message}` };
    }
  }

  revalidatePath("/usuarios");
  return { error: null };
}

/**
 * Desactivar un usuario (checkbox Activa apagado) le bloquea el ingreso
 * de inmediato — `lib/auth/usuario-actual.ts` y `login/actions.ts` ya
 * revisan este campo — sin borrar su cuenta ni su historial. Reactivarlo
 * es el mismo botón, prendiendo el checkbox de nuevo.
 */
export async function cambiarEstadoUsuario(formData: FormData) {
  await requireMaestro();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = createClient();
  await supabase
    .from("usuarios")
    .update({ activo: formData.get("activo") === "on" })
    .eq("id", id);

  revalidatePath("/usuarios");
}
