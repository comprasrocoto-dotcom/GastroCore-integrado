import "server-only";
import { createClient } from "@/lib/supabase/server";
import { recalcularReceta, recalcularSubreceta } from "@/lib/data/ingredientes";
import type { FilaArchivoCosto } from "@/lib/excel/costos";

/**
 * "Reemplazar insumos por marca" (12/11, pedido de Mariluz: poder cargar
 * un archivo nuevo que reemplace de una vez la base de insumos de una
 * marca entera, y también poder borrarla). Vive separado de
 * `lib/data/importar-costos.ts` (que solo actualiza el costo) porque acá
 * el archivo manda sobre TODOS los campos que trae — no solo el precio.
 *
 * Reglas de negocio confirmadas por Mariluz antes de programar esto:
 * - Se cruza PRIMERO por Referencia (el código de la columna "Referencia"
 *   del archivo) cuando el insumo existente ya tiene una cargada, y SOLO
 *   si no hay coincidencia ahí, se cae de respaldo al nombre exacto de
 *   artículo (normalizado) — igual que antes. (Cambiado 12/11, pedido de
 *   Mariluz: al cruzar solo por nombre, cada vez que renombraba un
 *   insumo en el archivo nuevo el sistema se lo duplicaba en vez de
 *   actualizarlo, porque para el nombre ya no era "el mismo". Un insumo
 *   que matchea por Referencia conserva su identidad aunque el nombre Y
 *   la unidad hayan cambiado en el archivo.)
 * - Si un insumo matchea por nombre pero todavía no tenía Referencia
 *   cargada, y el archivo sí trae un código para esa fila, ese código se
 *   guarda igual (ver más abajo, "el archivo reemplaza... referencia") —
 *   así la próxima carga ya lo puede cruzar por código aunque vuelva a
 *   cambiarle el nombre.
 * - Para un insumo que YA existe (coincide por Referencia o, a falta de
 *   eso, por nombre): el archivo
 *   reemplaza costo, unidad, subartículo, subfamilia y referencia — TODO
 *   lo que traiga (decisión explícita de Mariluz, 12/11: "todo lo que
 *   traiga el archivo"). Si una columna de una fila viene vacía, esa
 *   columna puntual NO se toca (no se borra un dato que ya estaba
 *   cargado solo porque esa celda vino en blanco) — el archivo solo
 *   "trae" lo que realmente escribe.
 * - Un insumo que el archivo no menciona para nada NO se toca (decisión
 *   explícita de Mariluz, 12/11) — "reemplazar" no implica "borrar los
 *   que falten", eso es una acción aparte (ver `desactivarInsumosMarca`
 *   más abajo).
 * - Las filas de subrecetas (código que arranca con "SUB") no se tocan
 *   nunca, igual que en la carga de costos: el costo de una subreceta se
 *   calcula solo a partir de sus ingredientes.
 * - Un artículo que matchea más de un insumo existente (duplicado en la
 *   base) no se toca automáticamente — queda "sin cambio" para resolver
 *   a mano, misma regla que la carga de costos.
 * - Se trabaja una marca a la vez, con un archivo por sede (confirmado
 *   12/11: Mariluz tiene un archivo separado por cada sede, no uno solo
 *   mezclado) — una marca con varias sedes (ej. San Agustín) sube varios
 *   archivos juntos en una sola pantalla, uno por cada sede.
 *
 * `crearSubfamiliasFaltantes` está duplicada acá a propósito (mismo
 * patrón que `lib/data/enviar-insumos.ts`), para no arriesgar tocar de
 * nuevo `importar-costos.ts`.
 */

function normalizarNombre(texto: string): string {
  return texto.trim().toUpperCase().replace(/\s+/g, " ");
}

function normalizarReferencia(texto: string): string {
  return texto.trim().toUpperCase();
}

const EPSILON_COSTE = 0.005;

export type AccionItemReemplazo = "actualizar" | "crear" | "sin_cambio";

export type ItemPlanReemplazo = {
  articulo: string;
  codigoArchivo: string | null;
  unidadCodigo: string | null;
  subarticulo: string | null;
  subfamiliaNombre: string | null;
  subfamiliaId: string | null;
  costeArchivo: number;
  costeAnterior: number | null;
  insumoId: string | null;
  accion: AccionItemReemplazo;
};

export type PlanReemplazoSede = {
  sedeId: string;
  sedeNombre: string;
  totalFilasArchivo: number;
  filasSubrecetaIgnoradas: number;
  items: ItemPlanReemplazo[];
  resumen: { aActualizar: number; aCrear: number; sinCambio: number };
};

/**
 * Arma el plan de UNA sede (una de las sedes de la marca, un archivo).
 * No toca la base de datos — solo lee y cruza.
 */
export async function armarPlanReemplazoSede(
  sedeId: string,
  sedeNombre: string,
  filas: FilaArchivoCosto[]
): Promise<PlanReemplazoSede> {
  const supabase = createClient();

  const filasInsumo = filas.filter((f) => !f.esSubreceta);
  const filasSubrecetaIgnoradas = filas.length - filasInsumo.length;

  const [{ data: insumosExistentes }, { data: subfamiliasExistentes }] = await Promise.all([
    supabase
      .from("insumos")
      .select("id, articulo, coste, unidad_codigo, subarticulo, referencia, subfamilia_id")
      .eq("sede_id", sedeId),
    supabase.from("subfamilias").select("id, nombre").eq("sede_id", sedeId).eq("activo", true),
  ]);

  type InsumoExistente = {
    id: string;
    coste: number;
    unidadCodigo: string | null;
    subarticulo: string | null;
    referencia: string | null;
    subfamiliaId: string | null;
  };

  const insumosPorNombre = new Map<string, InsumoExistente[]>();
  const insumosPorReferencia = new Map<string, InsumoExistente[]>();
  for (const i of insumosExistentes ?? []) {
    const entrada: InsumoExistente = {
      id: i.id as string,
      coste: Number(i.coste),
      unidadCodigo: i.unidad_codigo as string | null,
      subarticulo: i.subarticulo as string | null,
      referencia: i.referencia as string | null,
      subfamiliaId: i.subfamilia_id as string | null,
    };

    const claveNombre = normalizarNombre(i.articulo as string);
    const listaNombre = insumosPorNombre.get(claveNombre) ?? [];
    listaNombre.push(entrada);
    insumosPorNombre.set(claveNombre, listaNombre);

    const referenciaCruda = i.referencia as string | null;
    if (referenciaCruda && referenciaCruda.trim()) {
      const claveReferencia = normalizarReferencia(referenciaCruda);
      const listaReferencia = insumosPorReferencia.get(claveReferencia) ?? [];
      listaReferencia.push(entrada);
      insumosPorReferencia.set(claveReferencia, listaReferencia);
    }
  }

  const subfamiliaIdPorNombre = new Map<string, string>();
  for (const s of subfamiliasExistentes ?? []) {
    subfamiliaIdPorNombre.set(normalizarNombre(s.nombre as string), s.id as string);
  }

  const items: ItemPlanReemplazo[] = filasInsumo.map((fila) => {
    // Cruce: primero por Referencia (si el archivo trae un código Y ese
    // código ya está cargado en algún insumo existente), y solo si ahí
    // no hay coincidencia, de respaldo por nombre — ver nota arriba.
    const claveReferencia = fila.codigo && fila.codigo.trim() ? normalizarReferencia(fila.codigo) : null;
    const coincidenciasPorReferencia = claveReferencia ? insumosPorReferencia.get(claveReferencia) ?? [] : [];
    const claveNombre = normalizarNombre(fila.articulo);
    const coincidencias =
      coincidenciasPorReferencia.length > 0 ? coincidenciasPorReferencia : insumosPorNombre.get(claveNombre) ?? [];
    const subfamiliaId = fila.subfamiliaNombre
      ? subfamiliaIdPorNombre.get(normalizarNombre(fila.subfamiliaNombre)) ?? null
      : null;

    if (coincidencias.length === 1) {
      const [existente] = coincidencias;
      const cambiaCoste = Math.abs(existente.coste - fila.coste) > EPSILON_COSTE;
      const cambiaUnidad = Boolean(fila.unidadCodigo) && fila.unidadCodigo !== existente.unidadCodigo;
      const cambiaSubarticulo = Boolean(fila.subarticulo) && fila.subarticulo !== existente.subarticulo;
      const cambiaSubfamilia = Boolean(fila.subfamiliaNombre) && subfamiliaId !== null && subfamiliaId !== existente.subfamiliaId;
      const cambiaReferencia = Boolean(fila.codigo) && fila.codigo !== existente.referencia;
      const cambia = cambiaCoste || cambiaUnidad || cambiaSubarticulo || cambiaSubfamilia || cambiaReferencia;

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

    // Más de un insumo existente con la misma Referencia o el mismo
    // nombre (duplicado en la base) — no se toca automáticamente, queda
    // para resolver a mano.
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
    sedeNombre,
    totalFilasArchivo: filas.length,
    filasSubrecetaIgnoradas,
    items,
    resumen,
  };
}

function normalizarNombreFamilia(texto: string): string {
  return texto.trim().toUpperCase().replace(/\s+/g, " ");
}

/**
 * Busca o crea (familia + subfamilia, en ese orden) para cada nombre de
 * subfamilia que el archivo trae y que todavía no existe en la sede —
 * mismo patrón que `importar-costos.ts`/`enviar-insumos.ts`, duplicado a
 * propósito acá.
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

export type ResultadoAplicarReemplazoSede = { sedeId: string; actualizados: number; creados: number };

/**
 * Aplica el plan ya confirmado de UNA sede. No recalcula recetas/subrecetas
 * acá — eso se hace una sola vez al final, por `aplicarPlanReemplazoMarca`,
 * después de aplicar todas las sedes de la marca.
 */
async function aplicarPlanReemplazoSede(
  sedeId: string,
  usuarioId: string | null,
  items: ItemPlanReemplazo[]
): Promise<ResultadoAplicarReemplazoSede> {
  const supabase = createClient();

  let actualizados = 0;
  let creados = 0;

  const nombresSubfamiliaFaltante = new Set<string>();
  for (const item of items) {
    if (item.subfamiliaNombre && !item.subfamiliaId) {
      nombresSubfamiliaFaltante.add(item.subfamiliaNombre);
    }
  }
  const subfamiliaIdCreadaPorNombre = await crearSubfamiliasFaltantes(
    supabase,
    sedeId,
    Array.from(nombresSubfamiliaFaltante)
  );

  for (const item of items) {
    const subfamiliaId =
      item.subfamiliaId ??
      (item.subfamiliaNombre
        ? subfamiliaIdCreadaPorNombre.get(normalizarNombreFamilia(item.subfamiliaNombre)) ?? null
        : null);

    if (item.accion === "actualizar" && item.insumoId) {
      const cambios: Record<string, string | number> = { coste: item.costeArchivo };
      if (item.unidadCodigo) cambios.unidad_codigo = item.unidadCodigo;
      if (item.subarticulo) cambios.subarticulo = item.subarticulo;
      if (item.codigoArchivo) cambios.referencia = item.codigoArchivo;
      if (subfamiliaId) cambios.subfamilia_id = subfamiliaId;

      const { error } = await supabase.from("insumos").update(cambios).eq("id", item.insumoId);
      if (!error) {
        actualizados++;
        const cambioCoste =
          item.costeAnterior === null || Math.abs(item.costeAnterior - item.costeArchivo) > EPSILON_COSTE;
        if (cambioCoste) {
          await supabase.from("precios_historicos").insert({
            sede_id: sedeId,
            insumo_id: item.insumoId,
            coste: item.costeArchivo,
            coste_anterior: item.costeAnterior,
            diferencia: item.costeAnterior === null ? null : item.costeArchivo - item.costeAnterior,
            motivo: "Reemplazo masivo de insumos desde archivo",
            usuario_id: usuarioId,
          });
        }
      }
    } else if (item.accion === "crear") {
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

  return { sedeId, actualizados, creados };
}

export type ResultadoAplicarReemplazoMarca = {
  porSede: ResultadoAplicarReemplazoSede[];
  totalActualizados: number;
  totalCreados: number;
};

/**
 * Aplica el reemplazo de TODAS las sedes de la marca que se subieron en
 * esta carga, y al final recalcula subrecetas y recetas de cada sede
 * afectada (subrecetas primero, recetas después) — igual que
 * `importar-costos.ts`, para que el cambio se note de inmediato.
 */
export async function aplicarPlanReemplazoMarca(
  usuarioId: string | null,
  sedes: { sedeId: string; items: ItemPlanReemplazo[] }[]
): Promise<ResultadoAplicarReemplazoMarca> {
  const supabase = createClient();
  const porSede: ResultadoAplicarReemplazoSede[] = [];

  for (const sede of sedes) {
    const resultado = await aplicarPlanReemplazoSede(sede.sedeId, usuarioId, sede.items);
    porSede.push(resultado);
  }

  const sedesConCambios = porSede.filter((r) => r.actualizados > 0 || r.creados > 0).map((r) => r.sedeId);
  for (const sedeId of sedesConCambios) {
    const { data: subrecetas } = await supabase.from("subrecetas").select("id").eq("sede_id", sedeId);
    for (const s of subrecetas ?? []) {
      await recalcularSubreceta(s.id as string);
    }
    const { data: recetas } = await supabase.from("recetas").select("id").eq("sede_id", sedeId);
    for (const r of recetas ?? []) {
      await recalcularReceta(r.id as string);
    }
  }

  return {
    porSede,
    totalActualizados: porSede.reduce((acc, r) => acc + r.actualizados, 0),
    totalCreados: porSede.reduce((acc, r) => acc + r.creados, 0),
  };
}

/**
 * Cuenta cuántos insumos activos hay hoy en todas las sedes de una marca
 * — para mostrar en pantalla antes de desactivarlos ("esto va a afectar
 * a N insumos") y así Mariluz confirme con el número real a la vista.
 */
export async function contarInsumosActivosMarca(
  sedeIds: string[]
): Promise<number> {
  if (sedeIds.length === 0) return 0;
  const supabase = createClient();
  const { count } = await supabase
    .from("insumos")
    .select("id", { count: "exact", head: true })
    .in("sede_id", sedeIds)
    .eq("activo", true);
  return count ?? 0;
}

/**
 * "Borrar insumos de una marca" (12/11, pedido de Mariluz). Borrar un
 * insumo DE VERDAD no es posible mientras esté usado en alguna receta o
 * sea la base de una subreceta — la base de datos lo impide a propósito,
 * para no romper el costeo de nada que ya exista. Lo que hace esto en
 * cambio es DESACTIVARLOS (activo = false, el mismo campo que ya se usa
 * en toda la app): desaparecen de los selectores de nuevas recetas, pero
 * las recetas/subrecetas que ya los usan y su historial de precios no se
 * tocan para nada — es la única forma segura de "vaciar" la lista.
 */
export async function desactivarInsumosMarca(sedeIds: string[]): Promise<{ desactivados: number }> {
  if (sedeIds.length === 0) return { desactivados: 0 };
  const supabase = createClient();
  const { data, error } = await supabase
    .from("insumos")
    .update({ activo: false })
    .in("sede_id", sedeIds)
    .eq("activo", true)
    .select("id");
  if (error) return { desactivados: 0 };
  return { desactivados: data?.length ?? 0 };
}
