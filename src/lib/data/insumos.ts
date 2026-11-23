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
  centro_costo: string | null;
};

const PAGINA_TAMANO = 50;

export type FiltrosInsumos = { q?: string; subfamiliaId?: string; centroCosto?: string };

/**
 * Arma la consulta base de `insumos` con sus filtros (23/11, pedido de
 * Mariluz: poder filtrar por subfamilia — ej. "ver solo Licores" — y por
 * Centro de costo, calcando el listado del GastroCore viejo). La comparten
 * `listarInsumos` (paginada, para la pantalla) y `listarInsumosParaExportar`
 * (sin paginar, para el Excel) para no repetir la lógica de filtros.
 *
 * El join a `subfamilias` pasa a `!inner` SOLO cuando se filtra por Centro
 * de costo, porque ese campo vive en `subfamilias.centrocosto` y hay que
 * forzar el join para poder filtrar por una columna de la tabla
 * relacionada (si no, PostgREST no deja). El resto del tiempo queda como
 * join normal, para que los insumos sin subfamilia asignada sigan
 * apareciendo igual que antes.
 */
function construirConsultaInsumos(
  supabase: ReturnType<typeof createClient>,
  sedeId: string,
  opciones: FiltrosInsumos,
  conteo: boolean
) {
  const necesitaInner = Boolean(opciones.centroCosto);
  let query = supabase
    .from("insumos")
    .select(
      `id, referencia, articulo, subarticulo, unidad_codigo, coste, merma_std, activo, subfamilia_id, subfamilias${
        necesitaInner ? "!inner" : ""
      }(nombre, centrocosto, familias(nombre))`,
      conteo ? { count: "exact" } : undefined
    )
    .eq("sede_id", sedeId)
    .order("articulo");

  if (opciones.subfamiliaId) query = query.eq("subfamilia_id", opciones.subfamiliaId);
  if (opciones.centroCosto) query = query.eq("subfamilias.centrocosto", opciones.centroCosto);
  if (opciones.q) {
    query = query.or(
      `articulo.ilike.%${opciones.q}%,subarticulo.ilike.%${opciones.q}%,referencia.ilike.%${opciones.q}%`
    );
  }

  return query;
}

function filaAInsumo(fila: Record<string, unknown>): InsumoFila {
  const subfamilia = fila.subfamilias as unknown as {
    nombre: string;
    centrocosto: string | null;
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
    centro_costo: subfamilia?.centrocosto ?? null,
  };
}

export async function listarInsumos(
  sedeId: string,
  opciones: FiltrosInsumos & { pagina?: number } = {}
): Promise<{ insumos: InsumoFila[]; total: number; pagina: number; totalPaginas: number }> {
  const supabase = createClient();
  const pagina = Math.max(1, opciones.pagina ?? 1);
  const desde = (pagina - 1) * PAGINA_TAMANO;
  const hasta = desde + PAGINA_TAMANO - 1;

  const query = construirConsultaInsumos(supabase, sedeId, opciones, true).range(desde, hasta);

  const { data, count, error } = await query;
  if (error || !data) {
    return { insumos: [], total: 0, pagina, totalPaginas: 1 };
  }

  const insumos: InsumoFila[] = data.map(filaAInsumo);

  const total = count ?? insumos.length;
  return {
    insumos,
    total,
    pagina,
    totalPaginas: Math.max(1, Math.ceil(total / PAGINA_TAMANO)),
  };
}

/**
 * Mismo listado que `listarInsumos`, pero sin paginar — para el botón
 * "Descargar Excel" de Insumos (23/11, pedido de Mariluz): respeta la
 * búsqueda y los filtros que estén activos en pantalla, pero trae todos
 * los resultados de una vez en vez de 50 por página.
 */
export async function listarInsumosParaExportar(
  sedeId: string,
  opciones: FiltrosInsumos = {}
): Promise<InsumoFila[]> {
  const supabase = createClient();
  const query = construirConsultaInsumos(supabase, sedeId, opciones, false);

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(filaAInsumo);
}

/**
 * Lista de valores de "Centro de costo" que existen entre las subfamilias
 * de la sede (23/11, calcando el filtro "Centro de costo" del GastroCore
 * viejo) — ojo que es un campo de texto libre que no todas las sedes
 * tienen cargado todavía; acá solo se devuelven los que sí tienen algo
 * escrito, sin inventar valores para las sedes que lo dejaron vacío.
 */
export async function listarCentrosCosto(sedeId: string): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("subfamilias")
    .select("centrocosto")
    .eq("sede_id", sedeId)
    .not("centrocosto", "is", null);

  if (error || !data) return [];
  const valores = new Set<string>();
  data.forEach((fila) => {
    const valor = (fila.centrocosto as string | null)?.trim();
    if (valor) valores.add(valor);
  });
  return Array.from(valores).sort((a, b) => a.localeCompare(b));
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

/**
 * Último % de variación de precio de cada insumo de la sede (27/10),
 * para la "alerta roja" de Configuración — compara `coste` contra
 * `coste_anterior` del registro más reciente en `precios_historicos`
 * (ya se guarda ahí cada vez que cambia el costo de un insumo). Devuelve
 * un mapa `insumo_id -> % de variación` (puede ser negativo si bajó).
 */
export async function obtenerUltimasVariaciones(
  sedeId: string
): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("precios_historicos")
    .select("insumo_id, coste_anterior, diferencia, fecha")
    .eq("sede_id", sedeId)
    .order("fecha", { ascending: false })
    .limit(500);

  if (error || !data) return {};

  const variaciones: Record<string, number> = {};
  for (const fila of data) {
    const insumoId = fila.insumo_id as string;
    if (insumoId in variaciones) continue; // ya se guardó la más reciente de este insumo
    const costeAnterior = fila.coste_anterior === null ? null : Number(fila.coste_anterior);
    const diferencia = fila.diferencia === null ? null : Number(fila.diferencia);
    if (!costeAnterior || diferencia === null) continue;
    variaciones[insumoId] = (diferencia / costeAnterior) * 100;
  }
  return variaciones;
}

export type UsoInsumo = { tipo: "receta" | "subreceta" | "maestro_subreceta"; id: string; nombre: string };

/**
 * Dónde se usa un insumo (23/11, botón "Donde se usa" del listado de
 * Insumos, calcando el GastroCore viejo): en qué recetas y subrecetas
 * aparece como ingrediente, y si es el insumo "maestro" que representa a
 * alguna subreceta (el mismo chequeo que ya hace `eliminarInsumo` antes de
 * dejar borrar un insumo, acá mostrado en vez de solo bloqueado).
 */
export async function listarUsosDeInsumo(insumoId: string): Promise<UsoInsumo[]> {
  const supabase = createClient();

  const [ingredientesRes, maestroRes] = await Promise.all([
    supabase
      .from("ingredientes_receta")
      .select("receta_id, subreceta_duena_id, recetas(nombre), subrecetas!subreceta_duena_id(nombre)")
      .eq("insumo_id", insumoId),
    supabase.from("subrecetas").select("id, nombre").eq("insumo_id", insumoId),
  ]);

  const usos: UsoInsumo[] = [];
  const vistos = new Set<string>();

  (ingredientesRes.data ?? []).forEach((fila) => {
    const receta = fila.recetas as unknown as { nombre: string } | null;
    const subreceta = fila.subrecetas as unknown as { nombre: string } | null;
    if (fila.receta_id && receta && !vistos.has(`r:${fila.receta_id}`)) {
      vistos.add(`r:${fila.receta_id}`);
      usos.push({ tipo: "receta", id: fila.receta_id as string, nombre: receta.nombre });
    }
    if (fila.subreceta_duena_id && subreceta && !vistos.has(`s:${fila.subreceta_duena_id}`)) {
      vistos.add(`s:${fila.subreceta_duena_id}`);
      usos.push({ tipo: "subreceta", id: fila.subreceta_duena_id as string, nombre: subreceta.nombre });
    }
  });

  (maestroRes.data ?? []).forEach((fila) => {
    usos.push({ tipo: "maestro_subreceta", id: fila.id as string, nombre: fila.nombre as string });
  });

  return usos.sort((a, b) => a.nombre.localeCompare(b.nombre));
}
