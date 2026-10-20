import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Rol = "Admin" | "Chef" | "Lector";

export type UsuarioActual = {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  marca_id: string | null;
  sede_id: string | null;
  activo: boolean;
};

export async function getUsuarioActual(): Promise<UsuarioActual | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: usuario, error } = await supabase
    .from("usuarios")
    .select("id, email, nombre, rol, marca_id, sede_id, activo")
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
