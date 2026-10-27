import "server-only";
import { createClient } from "@/lib/supabase/server";

export type UsuarioBasico = {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
};

/**
 * Lista liviana de usuarios (solo id/nombre/email/activo) para el
 * checklist de "aplicar plantilla a estos usuarios" en Configuración —
 * separada de la lista que ya arma `usuarios/page.tsx` (que trae mucho
 * más: marca, sedes asignadas) porque ese detalle no hace falta acá.
 */
export async function listarUsuariosBasico(): Promise<UsuarioBasico[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nombre, email, activo")
    .order("nombre");

  if (error || !data) return [];

  return data.map((u) => ({
    id: u.id as string,
    nombre: u.nombre as string,
    email: u.email as string,
    activo: u.activo as boolean,
  }));
}
