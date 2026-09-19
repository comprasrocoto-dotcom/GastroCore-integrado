import "server-only";
import { createClient } from "@/lib/supabase/server";

export type SubrecetaFila = {
  id: string;
  nombre: string;
  rendimiento: number | null;
  unidad_rendimiento_codigo: string | null;
  merma_pct: number;
  desvio_pct: number;
  costo_total: number;
  costo_unitario: number;
  activo: boolean;
  insumo_id: string | null;
};

export async function listarSubrecetas(sedeId: string): Promise<SubrecetaFila[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("subrecetas")
    .select(
      "id, nombre, rendimiento, unidad_rendimiento_codigo, merma_pct, desvio_pct, costo_total, costo_unitario, activo, insumo_id"
    )
    .eq("sede_id", sedeId)
    .order("nombre");

  if (error || !data) return [];
  return data.map((s) => ({
    id: s.id as string,
    nombre: s.nombre as string,
    rendimiento: s.rendimiento === null ? null : Number(s.rendimiento),
    unidad_rendimiento_codigo: s.unidad_rendimiento_codigo as string | null,
    merma_pct: Number(s.merma_pct),
    desvio_pct: Number(s.desvio_pct),
    costo_total: Number(s.costo_total),
    costo_unitario: Number(s.costo_unitario),
    activo: s.activo as boolean,
    insumo_id: s.insumo_id as string | null,
  }));
}

export async function obtenerSubreceta(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("subrecetas")
    .select(
      "id, sede_id, nombre, rendimiento, unidad_rendimiento_codigo, merma_pct, desvio_pct, costo_total, costo_unitario, activo, insumo_id"
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return {
    ...data,
    rendimiento: data.rendimiento === null ? null : Number(data.rendimiento),
    merma_pct: Number(data.merma_pct),
    desvio_pct: Number(data.desvio_pct),
    costo_total: Number(data.costo_total),
    costo_unitario: Number(data.costo_unitario),
  };
}
