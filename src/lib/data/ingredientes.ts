import "server-only";
import { createClient } from "@/lib/supabase/server";

export type LineaIngrediente = {
  id: string;
  tipo_item: "insumo" | "subreceta";
  insumo_id: string | null;
  subreceta_id: string | null;
  descripcion: string;
  cantidad: number;
  unidad_codigo: string | null;
  merma_pct: number;
  costo_unitario: number;
  costo_linea: number;
  orden: number;
};

async function mapLineas(
  supabase: ReturnType<typeof createClient>,
  filtro: { receta_id?: string; subreceta_duena_id?: string }
): Promise<LineaIngrediente[]> {
  let query = supabase
    .from("ingredientes_receta")
    .select(
      "id, tipo_item, insumo_id, subreceta_id, cantidad, unidad_codigo, merma_pct, costo_unitario, costo_linea, orden, insumos(articulo, subarticulo), subrecetas(nombre)"
    )
    .order("orden");

  if (filtro.receta_id) query = query.eq("receta_id", filtro.receta_id);
  if (filtro.subreceta_duena_id)
    query = query.eq("subreceta_duena_id", filtro.subreceta_duena_id);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((fila) => {
    const insumo = fila.insumos as unknown as {
      articulo: string;
      subarticulo: string | null;
    } | null;
    const subreceta = fila.subrecetas as unknown as { nombre: string } | null;
    return {
      id: fila.id as string,
      tipo_item: fila.tipo_item as "insumo" | "subreceta",
      insumo_id: fila.insumo_id as string | null,
      subreceta_id: fila.subreceta_id as string | null,
      descripcion: insumo
        ? insumo.subarticulo
          ? `${insumo.articulo} — ${insumo.subarticulo}`
          : insumo.articulo
        : subreceta?.nombre ?? "—",
      cantidad: Number(fila.cantidad),
      unidad_codigo: fila.unidad_codigo as string | null,
      merma_pct: Number(fila.merma_pct),
      costo_unitario: Number(fila.costo_unitario),
      costo_linea: Number(fila.costo_linea),
      orden: fila.orden as number,
    };
  });
}

export async function listarIngredientesDeReceta(recetaId: string) {
  const supabase = createClient();
  return mapLineas(supabase, { receta_id: recetaId });
}

export async function listarIngredientesDeSubreceta(subrecetaId: string) {
  const supabase = createClient();
  return mapLineas(supabase, { subreceta_duena_id: subrecetaId });
}

export type OpcionInsumo = {
  id: string;
  etiqueta: string;
  referencia: string | null;
  subfamilia_nombre: string | null;
  coste: number;
  unidad_codigo: string | null;
  merma_std: number;
};

export async function listarInsumosParaPicker(
  sedeId: string
): Promise<OpcionInsumo[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("insumos")
    .select("id, referencia, articulo, subarticulo, coste, unidad_codigo, merma_std, subfamilias(nombre)")
    .eq("sede_id", sedeId)
    .eq("activo", true)
    .order("articulo");

  if (error || !data) return [];
  return data.map((i) => ({
    id: i.id as string,
    etiqueta: i.subarticulo ? `${i.articulo} — ${i.subarticulo}` : (i.articulo as string),
    referencia: i.referencia as string | null,
    subfamilia_nombre: (i.subfamilias as unknown as { nombre: string } | null)?.nombre ?? null,
    coste: Number(i.coste),
    unidad_codigo: i.unidad_codigo as string | null,
    merma_std: Number(i.merma_std ?? 0),
  }));
}

export type OpcionSubreceta = {
  id: string;
  etiqueta: string;
  costo_unitario: number;
  unidad_codigo: string | null;
};

export async function listarSubrecetasParaPicker(
  sedeId: string,
  excluirId?: string
): Promise<OpcionSubreceta[]> {
  const supabase = createClient();
  let query = supabase
    .from("subrecetas")
    .select("id, nombre, costo_unitario, unidad_rendimiento_codigo")
    .eq("sede_id", sedeId)
    .eq("activo", true)
    .order("nombre");

  if (excluirId) query = query.neq("id", excluirId);

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((s) => ({
    id: s.id as string,
    etiqueta: s.nombre as string,
    costo_unitario: Number(s.costo_unitario),
    unidad_codigo: s.unidad_rendimiento_codigo as string | null,
  }));
}

/**
 * Agrega una línea de ingrediente a una receta o a una subreceta (exactamente
 * uno de los dos "dueños"). El costo_unitario se toma en el momento de
 * agregar la línea (del insumo o de la subreceta elegida); costo_linea
 * aplica la merma de esa línea (la merma DIVIDE: cantidad real = cantidad
 * / (1 - merma)). Después hay que llamar a recalcular_receta /
 * recalcular_subreceta para que el total del dueño quede al día.
 */
export async function agregarLineaIngrediente(datos: {
  sedeId: string;
  recetaId?: string;
  subrecetaDuenaId?: string;
  tipoItem: "insumo" | "subreceta";
  insumoId?: string;
  subrecetaId?: string;
  cantidad: number;
  unidadCodigo: string | null;
  mermaPct: number;
  orden: number;
}) {
  const supabase = createClient();

  let costoUnitario = 0;
  if (datos.tipoItem === "insumo" && datos.insumoId) {
    const { data } = await supabase
      .from("insumos")
      .select("coste")
      .eq("id", datos.insumoId)
      .single();
    costoUnitario = Number(data?.coste ?? 0);
  } else if (datos.tipoItem === "subreceta" && datos.subrecetaId) {
    const { data } = await supabase
      .from("subrecetas")
      .select("costo_unitario")
      .eq("id", datos.subrecetaId)
      .single();
    costoUnitario = Number(data?.costo_unitario ?? 0);
  }

  const divisor = 1 - datos.mermaPct;
  const costoLinea = divisor > 0 ? (costoUnitario * datos.cantidad) / divisor : costoUnitario * datos.cantidad;

  return supabase.from("ingredientes_receta").insert({
    sede_id: datos.sedeId,
    receta_id: datos.recetaId ?? null,
    subreceta_duena_id: datos.subrecetaDuenaId ?? null,
    tipo_item: datos.tipoItem,
    insumo_id: datos.tipoItem === "insumo" ? datos.insumoId : null,
    subreceta_id: datos.tipoItem === "subreceta" ? datos.subrecetaId : null,
    cantidad: datos.cantidad,
    unidad_codigo: datos.unidadCodigo,
    merma_pct: datos.mermaPct,
    costo_unitario: costoUnitario,
    costo_linea: costoLinea,
    orden: datos.orden,
  });
}

export async function eliminarLineaIngrediente(id: string) {
  const supabase = createClient();
  return supabase.from("ingredientes_receta").delete().eq("id", id);
}

export async function recalcularReceta(recetaId: string) {
  const supabase = createClient();
  return supabase.rpc("recalcular_receta", { p_receta_id: recetaId });
}

export async function recalcularSubreceta(subrecetaId: string) {
  const supabase = createClient();
  return supabase.rpc("recalcular_subreceta", { p_subreceta_id: subrecetaId });
}
