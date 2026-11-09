import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * "Enviar insumos a otra marca" (09/11, pedido de Mariluz: poder
 * "amarrar" un artículo ya creado en una sede a otra, ej. un insumo de
 * Malanga a Tatequieto, sin tener que volver a cargarlo a mano).
 *
 * Reglas de negocio confirmadas por Mariluz antes de programar esto:
 * - Es una COPIA, no un vínculo: se crea un insumo NUEVO e independiente
 *   en la sede destino (mismo artículo, subartículo, unidad, Subfamilia
 *   y costo de origen como punto de partida). Si después cambia el costo
 *   en una sede, la otra no se entera — cada sede sigue su propio camino
 *   de ahí en adelante, porque compran a proveedores distintos.
 * - La Subfamilia se copia con el mismo nombre; si esa Subfamilia no
 *   existe todavía en la sede destino, se crea sola — y si tampoco existe
 *   la Familia, se crea también con el mismo nombre (mismo comportamiento
 *   que ya tiene la carga de costos desde archivo, ver
 *   `@/lib/data/importar-costos.ts`).
 * - Si en la sede destino YA existe un insumo con ese mismo nombre, no se
 *   toca nada de ese insumo (ni costo ni clasificación) — se deja la
 *   decisión a mano, se le avisa a Mariluz cuáles no se mandaron por ya
 *   existir en vez de pisar algo sin que ella lo vea.
 * - Se puede mandar más de un insumo a la vez (selección múltiple desde
 *   la pantalla de Insumos).
 */

function normalizarNombre(texto: string): string {
  return texto.trim().toUpperCase().replace(/\s+/g, " ");
}

export type ItemPlanEnvio = {
  insumoId: string;
  articulo: string;
  subarticulo: string | null;
  unidadCodigo: string | null;
  subfamiliaNombre: string | null;
  coste: number;
  yaExisteEnDestino: boolean;
};

export type PlanEnvio = {
  sedeOrigenId: string;
  sedeDestinoId: string;
  items: ItemPlanEnvio[];
  resumen: { aCrear: number; yaExisten: number };
};

/** Nombres de los artículos seleccionados, solo para mostrarlos en pantalla antes de previsualizar el envío. */
export async function obtenerArticulosPorIds(
  sedeId: string,
  insumoIds: string[]
): Promise<{ id: string; articulo: string }[]> {
  if (insumoIds.length === 0) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("insumos")
    .select("id, articulo")
    .eq("sede_id", sedeId)
    .in("id", insumoIds);
  return (data ?? []).map((f) => ({ id: f.id as string, articulo: f.articulo as string }));
}

export async function armarPlanEnvio(
  sedeOrigenId: string,
  sedeDestinoId: string,
  insumoIds: string[]
): Promise<PlanEnvio> {
  const supabase = createClient();

  const [{ data: insumosOrigen }, { data: insumosDestino }] = await Promise.all([
    supabase
      .from("insumos")
      .select("id, articulo, subarticulo, unidad_codigo, coste, subfamilias(nombre)")
      .eq("sede_id", sedeOrigenId)
      .in("id", insumoIds),
    supabase.from("insumos").select("articulo").eq("sede_id", sedeDestinoId),
  ]);

  const nombresEnDestino = new Set(
    (insumosDestino ?? []).map((i) => normalizarNombre(i.articulo as string))
  );

  const items: ItemPlanEnvio[] = (insumosOrigen ?? []).map((fila) => {
    const subfamilia = fila.subfamilias as unknown as { nombre: string } | null;
    return {
      insumoId: fila.id as string,
      articulo: fila.articulo as string,
      subarticulo: fila.subarticulo as string | null,
      unidadCodigo: fila.unidad_codigo as string | null,
      subfamiliaNombre: subfamilia?.nombre ?? null,
      coste: Number(fila.coste),
      yaExisteEnDestino: nombresEnDestino.has(normalizarNombre(fila.articulo as string)),
    };
  });

  const resumen = items.reduce(
    (acc, item) => {
      if (item.yaExisteEnDestino) acc.yaExisten++;
      else acc.aCrear++;
      return acc;
    },
    { aCrear: 0, yaExisten: 0 }
  );

  return { sedeOrigenId, sedeDestinoId, items, resumen };
}

/**
 * Busca o crea (familia + subfamilia, en ese orden) para cada nombre de
 * subfamilia que haga falta en la sede destino — misma lógica que
 * `crearSubfamiliasFaltantes` de `@/lib/data/importar-costos.ts`, acá
 * duplicada a propósito para no arriesgar tocar ese archivo de nuevo
 * justo después de un arreglo reciente ahí.
 */
async function crearSubfamiliasFaltantes(
  supabase: ReturnType<typeof createClient>,
  sedeId: string,
  nombres: string[]
): Promise<Map<string, string>> {
  const resultado = new Map<string, string>();
  if (nombres.length === 0) return resultado;

  const { data: familiasExistentes } = await supabase
    .from("familias")
    .select("id, nombre")
    .eq("sede_id", sedeId);
  const familiaIdPorNombre = new Map<string, string>();
  for (const f of familiasExistentes ?? []) {
    familiaIdPorNombre.set(normalizarNombre(f.nombre as string), f.id as string);
  }

  for (const nombre of nombres) {
    const clave = normalizarNombre(nombre);

    let familiaId = familiaIdPorNombre.get(clave);
    if (!familiaId) {
      const { data: familiaNueva, error: errorFamilia } = await supabase
        .from("familias")
        .insert({ sede_id: sedeId, nombre })
        .select("id")
        .single();
      if (errorFamilia || !familiaNueva) continue;
      familiaId = familiaNueva.id as string;
      familiaIdPorNombre.set(clave, familiaId);
    }

    const { data: subfamiliaNueva, error: errorSubfamilia } = await supabase
      .from("subfamilias")
      .insert({ sede_id: sedeId, familia_id: familiaId, nombre })
      .select("id")
      .single();
    if (errorSubfamilia || !subfamiliaNueva) continue;
    resultado.set(clave, subfamiliaNueva.id as string);
  }

  return resultado;
}

export type ResultadoAplicarEnvio = { creados: number };

/**
 * Aplica un plan ya confirmado por Mariluz — solo recibe los items que
 * SÍ se van a crear (la pantalla ya filtró los que ya existían en
 * destino antes de llamar acá). Busca/crea la Subfamilia en destino para
 * cada nombre distinto que haga falta, y después crea los insumos.
 */
export async function aplicarPlanEnvio(
  sedeDestinoId: string,
  items: ItemPlanEnvio[]
): Promise<ResultadoAplicarEnvio> {
  const supabase = createClient();

  const { data: subfamiliasExistentes } = await supabase
    .from("subfamilias")
    .select("id, nombre")
    .eq("sede_id", sedeDestinoId)
    .eq("activo", true);
  const subfamiliaIdPorNombre = new Map<string, string>();
  for (const s of subfamiliasExistentes ?? []) {
    subfamiliaIdPorNombre.set(normalizarNombre(s.nombre as string), s.id as string);
  }

  const nombresFaltantes = new Set<string>();
  for (const item of items) {
    if (item.subfamiliaNombre && !subfamiliaIdPorNombre.has(normalizarNombre(item.subfamiliaNombre))) {
      nombresFaltantes.add(item.subfamiliaNombre);
    }
  }
  const subfamiliaIdCreadaPorNombre = await crearSubfamiliasFaltantes(
    supabase,
    sedeDestinoId,
    Array.from(nombresFaltantes)
  );

  let creados = 0;
  for (const item of items) {
    const subfamiliaId = item.subfamiliaNombre
      ? subfamiliaIdPorNombre.get(normalizarNombre(item.subfamiliaNombre)) ??
        subfamiliaIdCreadaPorNombre.get(normalizarNombre(item.subfamiliaNombre)) ??
        null
      : null;

    const { error } = await supabase.from("insumos").insert({
      sede_id: sedeDestinoId,
      articulo: item.articulo,
      subarticulo: item.subarticulo,
      subfamilia_id: subfamiliaId,
      unidad_codigo: item.unidadCodigo,
      coste: item.coste,
    });
    if (!error) creados++;
  }

  return { creados };
}
