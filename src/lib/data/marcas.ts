import "server-only";
import { createClient } from "@/lib/supabase/server";

export type SedeAdmin = {
  id: string;
  nombre: string;
  activo: boolean;
};

export type MarcaAdmin = {
  id: string;
  nombre: string;
  activo: boolean;
  sedes: SedeAdmin[];
};

/**
 * Todas las marcas y sedes, activas e inactivas — para la pantalla de
 * administración (/marcas) y para el formulario de "crear usuario", que
 * necesita ofrecer cualquier marca/sede como alcance. A diferencia de
 * `getSedesVisibles` (lib/data/sedes.ts, que solo trae las activas, para
 * el selector de todos los días), acá hace falta ver también las
 * desactivadas, para poder reactivarlas.
 */
export async function listarMarcasConSedes(): Promise<MarcaAdmin[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marcas")
    .select("id, nombre, activo, sedes(id, nombre, activo)")
    .order("nombre");

  if (error || !data) return [];

  return data.map((m) => {
    const sedes = (m.sedes as unknown as SedeAdmin[]) ?? [];
    return {
      id: m.id as string,
      nombre: m.nombre as string,
      activo: m.activo as boolean,
      sedes: [...sedes].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    };
  });
}
