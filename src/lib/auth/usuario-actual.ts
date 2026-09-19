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

  if (error || !usuario) return null;

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
