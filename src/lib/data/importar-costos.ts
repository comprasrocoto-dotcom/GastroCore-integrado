import "server-only";
import { createClient } from "@/lib/supabase/server";
import { recalcularReceta, recalcularSubreceta } from "@/lib/data/ingredientes";
import type { FilaArchivoCosto } from "@/lib/excel/costos";

/**
 * Cruce y aplicación del archivo de costos (06/11, pedido de Mariluz:
 * "poder actualizar la base de datos por medio de archivos planos... y
 * que las recetas se les actualice el costo de inmediato"). Vive separado
 * de `lib/excel/costos.ts` porque esto sí necesita Supabase (buscar los
 * insumos/subfamilias de la sede para cruzar contra el archivo).
 *
 * Reglas de negocio confirmadas por Mariluz antes de programar esto:
 * - Se cruza por nombre exacto de artículo (normalizado), no por código:
 *   casi ningún insumo tiene "Referencia" cargada hoy. El código del
 *   archivo SÍ se guarda como referencia en los insumos que se crean
 *   nuevos, para ir completando ese dato de acá en adelante.
 * - Las filas de subrecetas (código que arranca con "SUB") no se tocan
 *   nunca en esta carga: el costo de una subreceta se calcula solo a
 *   partir de sus ingredientes, no es un valor que se pueda escribir
 *   encima.
 * - Un artículo del archivo que no existe todavía (ni con un nombre
 *   parecido) se crea como insumo nuevo, con el costo/subfamilia/unidad
 *   que traiga el archivo — aunque el nombre sea levemente distinto a
 *   uno que ya existe (ej. "LIMON TAHITI X KILO BAR" vs "LIMON TAHITI
 *   *KILO BAR"): Mariluz prefirió esto a arriesgarse a fusionar mal dos
 *   insumos distintos.
 * - Un insumo cuyo nombre matchea más de uno existente (duplicado en la
 *   base, como pasaba con "SUB. FOSFORITOS DE PAPA" en Rocoto) no se
 *   toca automáticamente — queda como "sin cambio" para resolverlo a
 *   mano, en vez de adivinar cuál de los dos es el correcto.
 * - La columna "Subartículo" del archivo (que en realidad trae la
 *   unidad en palabras) se guarda tal cual en el campo "Subartículo"
 *   del insumo nuevo, además de seguir usándose para calcular la
 *   Unidad — confirmado por Mariluz (09/11).
 * - Si la subfamilia del archivo no existe todavía en esa sede, se crea
 *   sola (igual que un insumo nuevo) — y si tampoco existe ninguna
 *   familia para esa subfamilia, se crea también una familia nueva con
 *   el mismo nombre que la subfamilia (ej. archivo trae "ABARROTES" →
 *   se crea familia "ABARROTES" con la subfamilia "ABARROTES" adentro).
 *   Confirmado por Mariluz (09/11) para el caso de una sede nueva
 *   (Tatequieto) que no tenía ninguna familia/subfamilia cargada
 *   todavía. Esto solo pasa para insumos que se están CREANDO — a un
 *   insumo ya existente que solo cambia de costo nunca se le toca la
 *   subfamilia, para no pisar una clasificación que Mariluz ya haya
 *   hecho a mano.
 */

export type AccionItemImportacion = "actualizar" | "crear" | "sin_cambio";

export type ItemPlanImportacion = {
  articulo: string;
  codigoArchivo: string | null;
  unidadCodigo: string | null;
  subarticulo: string | null;
  subfamiliaNombre: string | null;
  subfamiliaId: string | null;
  costeArchivo: number;
  costeAnterior: number | null;
  insumoId: string | null;
  accion: AccionItemImportacion;
};

export type PlanImportacion = {
  sedeId: string;
  totalFilasArchivo: number;
  filasSubrecetaIgnoradas: number;
  items: ItemPlanImportacion[];
  resumen: { aActualizar: number; aCrear: number; sinCambio: number };
};

function normalizarNombre(texto: string): string {
  return texto.trim().toUpperCase().replace(/\s+/g, " ");
}

// Dos costos se consideran "el mismo" si difieren menos de medio centavo —
// evita marcar como "cambio" lo que en realidad es solo redondeo de punto
// flotante entre el archivo y lo guardado en la base.
const EPSILON_COSTE = 0.005;

export async function armarPlanImportacion(
  sedeId: string,
  filas: FilaArchivoCosto[]
): Promise<PlanImportacion> {
  const supabase = createClient();

  const filasInsumo = filas.filter((f) => !f.esSubreceta);
  const filasSubrecetaIgnoradas = filas.length - filasInsumo.length;

  const [{ data: insumosExistentes }, { data: subfamiliasExistentes }] = await Promise.all([
    supabase.from("insumos").select("id, articulo, coste").eq("sede_id", sedeId),
    supabase.from("subfamilias").select("id, nombre").eq("sede_id", sedeId).eq("activo", true),
  ]);

  const insumosPorNombre = new Map<string, { id: string; coste: number }[]>();
  for (const i of insumosExistentes ?? []) {
    const clave = normalizarNombre(i.articulo as string);
    const lista = insumosPorNombre.get(clave) ?? [];
    lista.push({ id: i.id as string, coste: Number(i.coste) });
    insumosPorNombre.set(clave, lista);
  }

  const subfamiliaIdPorNombre = new Map<string, string>();
  for (const s of subfamiliasExistentes ?? []) {
    subfamiliaIdPorNombre.set(normalizarNombre(s.nombre as string), s.id as string);
  }

  const items: ItemPlanImportacion[] = filasInsumo.map((fila) => {
    const clave = normalizarNombre(fila.articulo);
    const coincidencias = insumosPorNombre.get(clave) ?? [];
    const subfamiliaId = fila.subfamiliaNombre
      ? subfamiliaIdPorNombre.get(normalizarNombre(fila.subfamiliaNombre)) ?? null
      : null;

    if (coincidencias.length === 1) {
      const [existente] = coincidencias;
      const cambia = Math.abs(existente.coste - fila.coste) > EPSILON_COSTE;
      return {
        articulo: fila.articulo,
        codigoArchivo: fila.codigo,
        unidadCodigo: fila.unidadCodigo,
        subarticulo: fila.subarticulo,
        subfamiliaNombre: fila.subfamiliaNombre,
        subfamiliaId,
        costeArchivo: fila.coste,
        costeAnterior: existente.coste,
        insumoId: existente.id,
        accion: cambia ? "actualizar" : "sin_cambio",
      };
    }

    if (coincidencias.length === 0) {
      return {
        articulo: fila.articulo,
        codigoArchivo: fila.codigo,
        unidadCodigo: fila.unidadCodigo,
        subarticulo: fila.subarticulo,
        subfamiliaNombre: fila.subfamiliaNombre,
        subfamiliaId,
        costeArchivo: fila.coste,
        costeAnterior: null,
        insumoId: null,
        accion: "crear",
      };
    }

    // Más de un insumo existente con el mismo nombre (duplicado en la
    // base) — no se toca automáticamente, queda para resolver a mano.
    return {
      articulo: fila.articulo,
      codigoArchivo: fila.codigo,
      unidadCodigo: fila.unidadCodigo,
      subarticulo: fila.subarticulo,
      subfamiliaNombre: fila.subfamiliaNombre,
      subfamiliaId,
      costeArchivo: fila.coste,
      costeAnterior: null,
      insumoId: null,
      accion: "sin_cambio",
    };
  });

  const resumen = items.reduce(
    (acc, item) => {
      if (item.accion === "actualizar") acc.aActualizar++;
      else if (item.accion === "crear") acc.aCrear++;
      else acc.sinCambio++;
      return acc;
    },
    { aActualizar: 0, aCrear: 0, sinCambio: 0 }
  );

  return {
    sedeId,
    totalFilasArchivo: filas.length,
    filasSubrecetaIgnoradas,
    items,
    resumen,
  };
}

export type ResultadoAplicarImportacion = {
  actualizados: number;
  creados: number;
};

/**
 * Aplica las filas "actualizar" y "crear" de un plan ya confirmado por
 * Mariluz, y al final recalcula el costo de TODAS las subrecetas y
 * recetas de la sede — igual que el botón "Poner costos al día" de
 * Configuración (mismo orden: subrecetas primero, recetas después,
 * porque una receta puede depender del costo de una subreceta) — para
 * que el cambio de costo de los insumos se note de inmediato en las
 * recetas, tal como lo pidió Mariluz.
 */
function normalizarNombreFamilia(texto: string): string {
  return texto.trim().toUpperCase().replace(/\s+/g, " ");
}

/**
 * Busca o crea (familia + subfamilia, en ese orden) para cada nombre de
 * subfamilia que el archivo trae y que todavía no existe en la sede.
 * La familia nueva se crea con el mismo nombre que la subfamilia, tal
 * como confirmó Mariluz (09/11) — después se puede reorganizar desde la
 * pantalla de Familias sin afectar ningún costo.
 *
 * Devuelve un mapa nombre normalizado → id de subfamilia, para los
 * nombres que hacía falta crear (los que ya existían no están acá,
 * `armarPlanImportacion` ya les había encontrado su id).
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
    familiaIdPorNombre.set(normalizarNombreFamilia(f.nombre as string), f.id as string);
  }

  for (const nombre of nombres) {
    const clave = normalizarNombreFamilia(nombre);

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

export async function aplicarPlanImportacion(
  sedeId: string,
  usuarioId: string | null,
  items: ItemPlanImportacion[]
): Promise<ResultadoAplicarImportacion> {
  const supabase = createClient();

  let actualizados = 0;
  let creados = 0;

  // Subfamilias que hacen falta crear: solo para insumos nuevos (nunca
  // se toca la subfamilia de uno que ya existía), y solo los nombres
  // que `armarPlanImportacion` no pudo encontrar.
  const nombresSubfamiliaFaltante = new Set<string>();
  for (const item of items) {
    if (item.accion === "crear" && item.subfamiliaNombre && !item.subfamiliaId) {
      nombresSubfamiliaFaltante.add(item.subfamiliaNombre);
    }
  }
  const subfamiliaIdCreadaPorNombre = await crearSubfamiliasFaltantes(
    supabase,
    sedeId,
    Array.from(nombresSubfamiliaFaltante)
  );

  for (const item of items) {
    if (item.accion === "actualizar" && item.insumoId) {
      const { error } = await supabase
        .from("insumos")
        .update({ coste: item.costeArchivo })
        .eq("id", item.insumoId);
      if (!error) {
        actualizados++;
        await supabase.from("precios_historicos").insert({
          sede_id: sedeId,
          insumo_id: item.insumoId,
          coste: item.costeArchivo,
          coste_anterior: item.costeAnterior,
          diferencia: item.costeAnterior === null ? null : item.costeArchivo - item.costeAnterior,
          motivo: "Carga masiva de costos desde archivo",
          usuario_id: usuarioId,
        });
      }
    } else if (item.accion === "crear") {
      const subfamiliaId =
        item.subfamiliaId ??
        (item.subfamiliaNombre
          ? subfamiliaIdCreadaPorNombre.get(normalizarNombreFamilia(item.subfamiliaNombre)) ?? null
          : null);
      const { error } = await supabase.from("insumos").insert({
        sede_id: sedeId,
        articulo: item.articulo,
        subarticulo: item.subarticulo,
        subfamilia_id: subfamiliaId,
        unidad_codigo: item.unidadCodigo,
        coste: item.costeArchivo,
        referencia: item.codigoArchivo,
      });
      if (!error) creados++;
    }
  }

  if (actualizados > 0 || creados > 0) {
    const { data: subrecetas } = await supabase.from("subrecetas").select("id").eq("sede_id", sedeId);
    for (const s of subrecetas ?? []) {
      await recalcularSubreceta(s.id as string);
    }

    const { data: recetas } = await supabase.from("recetas").select("id").eq("sede_id", sedeId);
    for (const r of recetas ?? []) {
      await recalcularReceta(r.id as string);
    }
  }

  return { actualizados, creados };
}
