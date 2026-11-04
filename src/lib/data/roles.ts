import "server-only";
import { createClient } from "@/lib/supabase/server";

export type RolRow = {
  id: string;
  nombre: string;
  esSistema: boolean;
  accesoTotal: boolean;
  modulos: string[] | null;
  area: "BAR" | "COCINA" | null;
};

/**
 * Roles reales de usuario (27/10) — reemplazan a `plantillas_permisos`.
 * Admin/Chef/Lector son roles de sistema (`esSistema`), protegidos: no
 * se pueden borrar ni renombrar desde acá. `accesoTotal` es lo único que
 * de verdad cambia la seguridad real (RLS) — equivale a lo que antes era
 * literalmente `rol = 'Admin'` en la base. `modulos`/`area` son solo el
 * valor por defecto que se copia a un usuario cuando se le asigna este
 * rol (pantallas que puede ver + Bar/Cocina), igual que hacían las
 * plantillas de permisos.
 */
export async function listarRoles(): Promise<RolRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("roles")
    .select("id, nombre, es_sistema, acceso_total, modulos, area")
    .order("es_sistema", { ascending: false })
    .order("nombre");

  if (error || !data) return [];

  return data.map((r) => ({
    id: r.id as string,
    nombre: r.nombre as string,
    esSistema: r.es_sistema as boolean,
    accesoTotal: r.acceso_total as boolean,
    modulos: r.modulos as string[] | null,
    area: r.area as "BAR" | "COCINA" | null,
  }));
}
