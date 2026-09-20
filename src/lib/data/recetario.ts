import "server-only";
import { createClient } from "@/lib/supabase/server";

export type RecetarioItem = {
  id: string;
  tipo: "receta" | "subreceta";
  nombre: string;
  familia_nombre: string | null;
  centrocosto: string | null;
  rendimiento: number | null;
  unidad_rendimiento_codigo: string | null;
  foto_url: string | null;
  ingredientes_count: number;
};

export type RecetarioDetalle = {
  id: string;
  tipo: "receta" | "subreceta";
  nombre: string;
  familia_nombre: string | null;
  rendimiento: number | null;
  unidad_rendimiento_codigo: string | null;
  tiempo_min: number | null;
  preparacion: string | null;
  emplatado: string | null;
  notas: string | null;
  foto_url: string | null;
  ingredientes: { descripcion: string; cantidad: number; unidad_codigo: string | null }[];
};

/**
 * Recetario para cocina: recetas + subrecetas de la sede, sin costos ni
 * precios, listas para armar tarjetas con categoría (familia), Centro de
 * Costo (Bar/Cocina, cuando esté cargado en `familias.centrocosto`) y
 * cantidad de ingredientes. Lee de las vistas `recetario_publico*`
 * (security_invoker = true), así que la RLS de siempre sigue filtrando
 * por sede.
 */
export async function listarRecetario(sedeId: string): Promise<RecetarioItem[]> {
  const supabase = createClient();

  const [{ data: recetas }, { data: subrecetas }, { data: ingRecetas }, { data: ingSub }] =
    await Promise.all([
      supabase
        .from("recetario_publico")
        .select("receta_id, receta_nombre, familia_nombre, centrocosto, rendimiento, unidad_rendimiento_codigo, foto_url, activo")
        .eq("sede_id", sedeId)
        .eq("activo", true),
      supabase
        .from("recetario_publico_subrecetas")
        .select("subreceta_id, subreceta_nombre, familia_nombre, centrocosto, rendimiento, unidad_rendimiento_codigo, foto_url, activo")
        .eq("sede_id", sedeId)
        .eq("activo", true),
      supabase.from("recetario_publico_ingredientes").select("receta_id"),
      supabase.from("recetario_publico_ingredientes_subreceta").select("subreceta_id"),
    ]);

  const contarPorId = (filas: { [k: string]: unknown }[] | null, campo: string) => {
    const mapa = new Map<string, number>();
    for (const fila of filas ?? []) {
      const id = fila[campo] as string;
      mapa.set(id, (mapa.get(id) ?? 0) + 1);
    }
    return mapa;
  };
  const conteoRecetas = contarPorId(ingRecetas, "receta_id");
  const conteoSub = contarPorId(ingSub, "subreceta_id");

  const items: RecetarioItem[] = [
    ...(recetas ?? []).map((r) => ({
      id: r.receta_id as string,
      tipo: "receta" as const,
      nombre: r.receta_nombre as string,
      familia_nombre: r.familia_nombre as string | null,
      centrocosto: r.centrocosto as string | null,
      rendimiento: r.rendimiento === null ? null : Number(r.rendimiento),
      unidad_rendimiento_codigo: r.unidad_rendimiento_codigo as string | null,
      foto_url: r.foto_url as string | null,
      ingredientes_count: conteoRecetas.get(r.receta_id as string) ?? 0,
    })),
    ...(subrecetas ?? []).map((s) => ({
      id: s.subreceta_id as string,
      tipo: "subreceta" as const,
      nombre: s.subreceta_nombre as string,
      familia_nombre: s.familia_nombre as string | null,
      centrocosto: s.centrocosto as string | null,
      rendimiento: s.rendimiento === null ? null : Number(s.rendimiento),
      unidad_rendimiento_codigo: s.unidad_rendimiento_codigo as string | null,
      foto_url: s.foto_url as string | null,
      ingredientes_count: conteoSub.get(s.subreceta_id as string) ?? 0,
    })),
  ];

  return items.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function obtenerDetalleRecetario(
  tipo: "receta" | "subreceta",
  id: string
): Promise<RecetarioDetalle | null> {
  const supabase = createClient();

  if (tipo === "receta") {
    const [{ data: receta }, { data: ingredientes }] = await Promise.all([
      supabase.from("recetario_publico").select("*").eq("receta_id", id).maybeSingle(),
      supabase
        .from("recetario_publico_ingredientes")
        .select("orden, descripcion, cantidad, unidad_codigo")
        .eq("receta_id", id)
        .order("orden"),
    ]);
    if (!receta) return null;
    return {
      id: receta.receta_id,
      tipo: "receta",
      nombre: receta.receta_nombre,
      familia_nombre: receta.familia_nombre,
      rendimiento: receta.rendimiento === null ? null : Number(receta.rendimiento),
      unidad_rendimiento_codigo: receta.unidad_rendimiento_codigo,
      tiempo_min: receta.tiempo_min === null ? null : Number(receta.tiempo_min),
      preparacion: receta.preparacion,
      emplatado: receta.emplatado,
      notas: receta.notas,
      foto_url: receta.foto_url,
      ingredientes: (ingredientes ?? []).map((i) => ({
        descripcion: i.descripcion,
        cantidad: Number(i.cantidad),
        unidad_codigo: i.unidad_codigo,
      })),
    };
  }

  const [{ data: subreceta }, { data: ingredientes }] = await Promise.all([
    supabase.from("recetario_publico_subrecetas").select("*").eq("subreceta_id", id).maybeSingle(),
    supabase
      .from("recetario_publico_ingredientes_subreceta")
      .select("orden, descripcion, cantidad, unidad_codigo")
      .eq("subreceta_id", id)
      .order("orden"),
  ]);
  if (!subreceta) return null;
  return {
    id: subreceta.subreceta_id,
    tipo: "subreceta",
    nombre: subreceta.subreceta_nombre,
    familia_nombre: subreceta.familia_nombre,
    rendimiento: subreceta.rendimiento === null ? null : Number(subreceta.rendimiento),
    unidad_rendimiento_codigo: subreceta.unidad_rendimiento_codigo,
    tiempo_min: null,
    preparacion: null,
    emplatado: null,
    notas: null,
    foto_url: subreceta.foto_url,
    ingredientes: (ingredientes ?? []).map((i) => ({
      descripcion: i.descripcion,
      cantidad: Number(i.cantidad),
      unidad_codigo: i.unidad_codigo,
    })),
  };
}
