import "server-only";
import { createClient } from "@/lib/supabase/server";
import { agregarLineaIngrediente, recalcularReceta } from "./ingredientes";

export type RecetaFila = {
  id: string;
  nombre: string;
  familia_id: string | null;
  familia_nombre: string | null;
  /** Food cost objetivo propio de la familia de esta receta (fracción),
   * o `null` si la familia no tiene uno propio — en ese caso se usa el de
   * Configuración (la sede), igual que siempre. */
  familia_fc_objetivo: number | null;
  subfamilia_id: string | null;
  subfamilia_nombre: string | null;
  rendimiento: number | null;
  unidad_rendimiento_codigo: string | null;
  merma_pct: number;
  desvio_pct: number;
  costo_total: number;
  costo_porcion: number;
  precio_real: number | null;
  iva: number;
  activo: boolean;
  actualizado_en: string;
};

export async function listarRecetas(sedeId: string): Promise<RecetaFila[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("recetas")
    .select(
      "id, nombre, familia_id, subfamilia_id, rendimiento, unidad_rendimiento_codigo, merma_pct, desvio_pct, costo_total, costo_porcion, precio_real, iva, activo, actualizado_en, familias(nombre, fc_objetivo), subfamilias(nombre)"
    )
    .eq("sede_id", sedeId)
    .order("nombre");

  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id as string,
    nombre: r.nombre as string,
    familia_id: r.familia_id as string | null,
    familia_nombre: (r.familias as unknown as { nombre: string; fc_objetivo: number | null } | null)?.nombre ?? null,
    familia_fc_objetivo:
      (r.familias as unknown as { nombre: string; fc_objetivo: number | null } | null)?.fc_objetivo ?? null,
    subfamilia_id: r.subfamilia_id as string | null,
    subfamilia_nombre: (r.subfamilias as unknown as { nombre: string } | null)?.nombre ?? null,
    rendimiento: r.rendimiento === null ? null : Number(r.rendimiento),
    unidad_rendimiento_codigo: r.unidad_rendimiento_codigo as string | null,
    merma_pct: Number(r.merma_pct),
    desvio_pct: Number(r.desvio_pct),
    costo_total: Number(r.costo_total),
    costo_porcion: Number(r.costo_porcion),
    precio_real: r.precio_real === null ? null : Number(r.precio_real),
    iva: Number(r.iva),
    activo: r.activo as boolean,
    actualizado_en: r.actualizado_en as string,
  }));
}

export async function obtenerReceta(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("recetas")
    .select(
      "id, sede_id, nombre, familia_id, subfamilia_id, rendimiento, unidad_rendimiento_codigo, merma_pct, desvio_pct, costo_total, costo_porcion, precio_real, iva, activo, creado_en, actualizado_en, familias(nombre, fc_objetivo), subfamilias(nombre), sedes(nombre)"
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;
  const { familias, subfamilias, sedes, ...resto } = data as typeof data & {
    familias: { nombre: string; fc_objetivo: number | null } | null;
    subfamilias: { nombre: string } | null;
    sedes: { nombre: string } | null;
  };
  return {
    ...resto,
    familia_nombre: (familias as unknown as { nombre: string; fc_objetivo: number | null } | null)?.nombre ?? null,
    familia_fc_objetivo:
      (familias as unknown as { nombre: string; fc_objetivo: number | null } | null)?.fc_objetivo ?? null,
    subfamilia_nombre: (subfamilias as unknown as { nombre: string } | null)?.nombre ?? null,
    sede_nombre: (sedes as unknown as { nombre: string } | null)?.nombre ?? null,
    rendimiento: data.rendimiento === null ? null : Number(data.rendimiento),
    merma_pct: Number(data.merma_pct),
    desvio_pct: Number(data.desvio_pct),
    costo_total: Number(data.costo_total),
    costo_porcion: Number(data.costo_porcion),
    precio_real: data.precio_real === null ? null : Number(data.precio_real),
    iva: Number(data.iva),
  };
}

/**
 * Crea una receta y sus ingredientes en un solo paso — usado por la
 * pantalla "Nueva receta", que arma toda la lista de ingredientes en el
 * navegador (como GastroCore) y recién guarda todo junto al final.
 * Reutiliza `agregarLineaIngrediente` para que el costo_unitario de cada
 * línea se tome siempre del insumo/subreceta en la base (no de lo que
 * mandó el navegador), y `recalcular_receta` para que costo_total/
 * costo_porcion queden oficialmente al día del lado de Postgres.
 */
export async function crearRecetaConIngredientes(datos: {
  sedeId: string;
  nombre: string;
  familiaId: string | null;
  subfamiliaId: string | null;
  rendimiento: number | null;
  unidadRendimientoCodigo: string | null;
  desvioPct: number;
  precioReal: number | null;
  lineas: {
    tipoItem: "insumo" | "subreceta";
    itemId: string;
    cantidad: number;
    unidadCodigo: string | null;
    mermaPct: number;
  }[];
}): Promise<{ id: string } | { error: string }> {
  const supabase = createClient();

  const { data: receta, error } = await supabase
    .from("recetas")
    .insert({
      sede_id: datos.sedeId,
      nombre: datos.nombre,
      familia_id: datos.familiaId,
      subfamilia_id: datos.subfamiliaId,
      rendimiento: datos.rendimiento,
      unidad_rendimiento_codigo: datos.unidadRendimientoCodigo,
      desvio_pct: datos.desvioPct,
      precio_real: datos.precioReal,
    })
    .select("id")
    .single();

  if (error || !receta) {
    return { error: error?.message ?? "No se pudo crear la receta." };
  }

  for (const [idx, linea] of datos.lineas.entries()) {
    await agregarLineaIngrediente({
      sedeId: datos.sedeId,
      recetaId: receta.id,
      tipoItem: linea.tipoItem,
      insumoId: linea.tipoItem === "insumo" ? linea.itemId : undefined,
      subrecetaId: linea.tipoItem === "subreceta" ? linea.itemId : undefined,
      cantidad: linea.cantidad,
      unidadCodigo: linea.unidadCodigo,
      mermaPct: linea.mermaPct,
      orden: idx + 1,
    });
  }

  await recalcularReceta(receta.id);

  return { id: receta.id as string };
}

/**
 * Actualiza una receta existente y reemplaza toda su lista de
 * ingredientes — usada por la pantalla "Nueva receta" (RecetaForm)
 * reutilizada en modo edición (`/recetas/nueva?edit=ID`), igual que
 * GastroCore. Reemplaza en vez de "parchear" línea por línea: borra las
 * líneas anteriores de esta receta y vuelve a armarlas con lo que llega
 * del navegador, tal como hace `crearRecetaConIngredientes`.
 */
export async function actualizarRecetaConIngredientes(datos: {
  id: string;
  sedeId: string;
  nombre: string;
  familiaId: string | null;
  rendimiento: number | null;
  unidadRendimientoCodigo: string | null;
  desvioPct: number;
  precioReal: number | null;
  lineas: {
    tipoItem: "insumo" | "subreceta";
    itemId: string;
    cantidad: number;
    unidadCodigo: string | null;
    mermaPct: number;
  }[];
}): Promise<{ id: string } | { error: string }> {
  const supabase = createClient();

  const { error: errorUpdate } = await supabase
    .from("recetas")
    .update({
      nombre: datos.nombre,
      familia_id: datos.familiaId,
      rendimiento: datos.rendimiento,
      unidad_rendimiento_codigo: datos.unidadRendimientoCodigo,
      desvio_pct: datos.desvioPct,
      precio_real: datos.precioReal,
    })
    .eq("id", datos.id);

  if (errorUpdate) {
    return { error: errorUpdate.message };
  }

  const { error: errorDelete } = await supabase
    .from("ingredientes_receta")
    .delete()
    .eq("receta_id", datos.id);

  if (errorDelete) {
    return { error: errorDelete.message };
  }

  for (const [idx, linea] of datos.lineas.entries()) {
    await agregarLineaIngrediente({
      sedeId: datos.sedeId,
      recetaId: datos.id,
      tipoItem: linea.tipoItem,
      insumoId: linea.tipoItem === "insumo" ? linea.itemId : undefined,
      subrecetaId: linea.tipoItem === "subreceta" ? linea.itemId : undefined,
      cantidad: linea.cantidad,
      unidadCodigo: linea.unidadCodigo,
      mermaPct: linea.mermaPct,
      orden: idx + 1,
    });
  }

  await recalcularReceta(datos.id);

  return { id: datos.id };
}

export async function listarFamiliasParaPicker(sedeId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("familias")
    .select("id, nombre, fc_objetivo")
    .eq("sede_id", sedeId)
    .eq("activo", true)
    .order("nombre");

  if (error || !data) return [];
  return data.map((f) => ({
    id: f.id as string,
    nombre: f.nombre as string,
    fcObjetivo: f.fc_objetivo === null ? null : Number(f.fc_objetivo),
  }));
}
