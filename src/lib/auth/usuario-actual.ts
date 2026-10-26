import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Rol = "Admin" | "Chef" | "Lector";

/** Módulos que se pueden restringir por usuario desde "Usuarios" (ver
 * CrearUsuarioForm/EditarUsuarioForm). "Marcas" y "Usuarios" no están acá
 * porque ya están reservados al Admin multi-marca por otro lado. */
export const MODULOS_DISPONIBLES = [
  "insumos",
  "subrecetas",
  "recetas",
  "familias",
  "configuracion",
  "recetario",
] as const;
export type Modulo = (typeof MODULOS_DISPONIBLES)[number];

export type UsuarioActual = {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  marca_id: string | null;
  sede_id: string | null;
  activo: boolean;
  /** `null` = sin restricciones (ve todas las pantallas, como siempre
   * fue hasta ahora). Un array (aunque esté vacío) restringe la
   * navegación a esos módulos exactos. */
  modulos: string[] | null;
  /** `null` = sin restricción de área. "BAR" o "COCINA" filtra Recetas y
   * Recetario por `familias.centrocosto`, igual que ya hacía la clave
   * compartida del Recetario (ver RecetarioClaveGate) pero atado a la
   * identidad del usuario, sin pedir ninguna clave. */
  area: "BAR" | "COCINA" | null;
};

export async function getUsuarioActual(): Promise<UsuarioActual | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: usuario, error } = await supabase
    .from("usuarios")
    .select("id, email, nombre, rol, marca_id, sede_id, activo, modulos, area")
    .eq("id", user.id)
    .single();

  // Un usuario desactivado desde la pantalla "Usuarios" sigue existiendo
  // en Supabase Auth (podría iniciar sesión), pero acá se lo tratamos
  // como si no estuviera logueado — así el Layout protegido lo manda de
  // vuelta a /login en cualquier pantalla, sin tener que tocar nada en
  // Auth. `login/actions.ts` hace la misma revisión antes, para avisarle
  // con un mensaje claro en vez de dejarlo rebotando en silencio.
  if (error || !usuario || !usuario.activo) return null;

  return usuario as UsuarioActual;
}

export function esMaestro(usuario: Pick<UsuarioActual, "marca_id" | "rol">) {
  return usuario.rol === "Admin" && usuario.marca_id === null;
}

export function esAdminDeMarca(
  usuario: Pick<UsuarioActual, "marca_id" | "sede_id" | "rol">
) {
  return (
    usuario.rol === "Admin" &&
    usuario.marca_id !== null &&
    usuario.sede_id === null
  );
}

/**
 * ¿Puede este usuario ver/usar el módulo `modulo` (ej. "insumos")? El
 * Admin multi-marca siempre ve todo, sin excepción — administra el
 * sistema entero y es quien reparte estos mismos permisos. Para el
 * resto: `modulos === null` significa "sin restricciones" (así quedan
 * todos los usuarios existentes antes de este cambio, sin que nadie
 * pierda acceso a nada); si tiene un array cargado, solo ve lo que está
 * en esa lista.
 *
 * Se usa tanto para filtrar la navegación (HeaderProtegido) como para
 * bloquear la pantalla si alguien escribe la URL directamente (ver los
 * guards al principio de insumos/subrecetas/familias/configuracion).
 */
export function tieneModulo(
  usuario: Pick<UsuarioActual, "marca_id" | "rol" | "modulos">,
  modulo: Modulo
) {
  if (esMaestro(usuario)) return true;
  if (!usuario.modulos) return true;
  return usuario.modulos.includes(modulo);
}
