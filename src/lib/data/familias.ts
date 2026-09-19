import "server-only";
import { createClient } from "@/lib/supabase/server";

export type SubfamiliaFila = {
  id: string;
  nombre: string;
  tipo: string | null;
  centrocosto: string | null;
  activo: boolean;
};

export type FamiliaFila = {
  id: string;
  nombre: string;
  tipo: string | null;
  centrocosto: string | null;
  activo: boolean;
  subfamilias: SubfamiliaFila[];
};

export async function listarFamiliasConSubfamilias(
  sedeId: string
): Promise<FamiliaFila[]> {
  const supabase = createClient();

  const [{ data: familias }, { data: subfamilias }] = await Promise.all([
    supabase
      .from("familias")
      .select("id, nombre, tipo, centrocosto, activo")
      .eq("sede_id", sedeId)
      .order("nombre"),
    supabase
      .from("subfamilias")
      .select("id, nombre, tipo, centrocosto, activo, familia_id")
      .eq("sede_id", sedeId)
      .order("nombre"),
  ]);

  if (!familias) return [];

  return familias.map((f) => ({
    id: f.id as string,
    nombre: f.nombre as string,
    tipo: f.tipo as string | null,
    centrocosto: f.centrocosto as string | null,
    activo: f.activo as boolean,
    subfamilias: (subfamilias ?? [])
      .filter((s) => s.familia_id === f.id)
      .map((s) => ({
        id: s.id as string,
        nombre: s.nombre as string,
        tipo: s.tipo as string | null,
        centrocosto: s.centrocosto as string | null,
        activo: s.activo as boolean,
      })),
  }));
}
