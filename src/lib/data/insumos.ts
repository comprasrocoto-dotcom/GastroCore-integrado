import "server-only";
import { createClient } from "@/lib/supabase/server";

export type InsumoFila = {
  id: string;
  referencia: string | null;
  articulo: string;
  subarticulo: string | null;
  unidad_codigo: string | null;
  coste: number;
  merma_std: number | null;
  activo: boolean;
  subfamilia_id: string | null;
  subfamilia_nombre: string | null;
  familia_nombre: string | null;
};

const PAGINA_TAMANO = 50;

export async function listarInsumos(
  sedeId: string,
  opciones: { q?: string; pagina?: number } = {}
): Promise<{ insumos: InsumoFila[]; total: number; pagina: number; totalPaginas: number }> {
  const supabase = createClient();
  const pagina = Math.max(1, opciones.pagina ?? 1);
  const desde = (pagina - 1) * PAGINA_TAMANO;
  const hasta = desde + PAGINA_TAMANO - 1;

  let query = supabase
    .from("insumos")
    .select(
      "id, referencia, articulo, subarticulo, unidad_codigo, coste, merma_std, activo, subfamilia_id, subfamilias(nombre, familias(nombre))",
      { count: "exact" }
    )
    .eq("sede_id", sedeId)
    .order("articulo")
    .range(desde, hasta);

  if (opciones.q) {
    query = query.or(
      `articulo.ilike.%${opciones.q}%,subarticulo.ilike.%${opciones.q}%,referencia.ilike.%${opciones.q}%`
    );
  }

  const { data, count, error } = await query;
  if (error || !data) {
    return { insumos: [], total: 0, pagina, totalPaginas: 1 };
  }

  const insumos: InsumoFila[] = data.map((fila) => {
    const subfamilia = fila.subfamilias as unknown as {
      nombre: string;
      familias: { nombre: string } | null;
    } | null;
    return {
      id: fila.id as string,
      referencia: fila.referencia as string | null,
      articulo: fila.articulo as string,
      subarticulo: fila.subarticulo as string | null,
      unidad_codigo: fila.unidad_codigo as string | null,
      coste: Number(fila.coste),
      merma_std: fila.merma_std === null ? null : Number(fila.merma_std),
      activo: fila.activo as boolean,
      subfamilia_id: fila.subfamilia_id as string | null,
      subfamilia_nombre: subfamilia?.nombre ?? null,
      familia_nombre: subfamilia?.familias?.nombre ?? null,
    };
  });

  const total = count ?? insumos.length;
  return {
    insumos,
    total,
    pagina,
    totalPaginas: Math.max(1, Math.ceil(total / PAGINA_TAMANO)),
  };
}

export async function obtenerInsumo(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("insumos")
    .select(
      "id, sede_id, referencia, articulo, subarticulo, unidad_codigo, coste, merma_std, activo, subfamilia_id"
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return { ...data, coste: Number(data.coste) };
}

export async function listarHistorialPrecios(insumoId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("precios_historicos")
    .select("id, coste, coste_anterior, diferencia, motivo, fecha, usuarios(nombre)")
    .eq("insumo_id", insumoId)
    .order("fecha", { ascending: false })
    .limit(20);

  if (error || !data) return [];
  return data.map((fila) => ({
    id: fila.id as string,
    coste: Number(fila.coste),
    coste_anterior: fila.coste_anterior === null ? null : Number(fila.coste_anterior),
    diferencia: fila.diferencia === null ? null : Number(fila.diferencia),
    motivo: fila.motivo as string | null,
    fecha: fila.fecha as string,
    usuario_nombre: (fila.usuarios as unknown as { nombre: string } | null)?.nombre ?? null,
  }));
}

export async function listarSubfamilias(sedeId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("subfamilias")
    .select("id, nombre, familias(nombre)")
    .eq("sede_id", sedeId)
    .eq("activo", true)
    .order("nombre");

  if (error || !data) return [];
  return data.map((fila) => ({
    id: fila.id as string,
    nombre: fila.nombre as string,
    familia_nombre: (fila.familias as unknown as { nombre: string } | null)?.nombre ?? "",
  }));
}

export async function listarUnidades() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("unidades_medida")
    .select("codigo, nombre")
    .eq("activo", true)
    .order("codigo");

  if (error || !data) return [];
  return data as { codigo: string; nombre: string }[];
}
