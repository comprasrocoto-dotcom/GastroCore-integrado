import "server-only";
import { createClient } from "@/lib/supabase/server";
import { agregarLineaIngrediente, recalcularSubreceta } from "./ingredientes";

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
  insumo_referencia: string | null;
  insumo_coste: number | null;
};

/**
 * Trae las subrecetas junto con el insumo "SUB." que las refleja (ver
 * patrón maestro-calculadora en subrecetas/actions.ts), para poder mostrar
 * su referencia y comparar su costo contra el costo_unitario recién
 * calculado de la subreceta — así se detecta cuándo el insumo maestro
 * quedó desactualizado (columna "Insumos vs subreceta" del listado).
 */
export async function listarSubrecetas(sedeId: string): Promise<SubrecetaFila[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("subrecetas")
    .select(
      "id, nombre, rendimiento, unidad_rendimiento_codigo, merma_pct, desvio_pct, costo_total, costo_unitario, activo, insumo_id, insumos(referencia, coste)"
    )
    .eq("sede_id", sedeId)
    .order("nombre");

  if (error || !data) return [];
  return data.map((s) => {
    const insumo = s.insumos as unknown as { referencia: string | null; coste: number } | null;
    return {
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
      insumo_referencia: insumo?.referencia ?? null,
      insumo_coste: insumo ? Number(insumo.coste) : null,
    };
  });
}

export type InsumoSubSinVincular = {
  id: string;
  articulo: string;
  referencia: string | null;
  coste: number;
  unidad_codigo: string | null;
};

/**
 * Preparaciones "SUB." que ya existen como insumo maestro pero todavía no
 * están enlazadas a ninguna subreceta — es el panel "Buscar en insumos" de
 * la pantalla "Nueva subreceta" (igual que GastroCore): permite retomar un
 * maestro que se creó antes (por ejemplo por carga masiva) en vez de crear
 * uno duplicado.
 */
export async function listarInsumosSubSinVincular(sedeId: string): Promise<InsumoSubSinVincular[]> {
  const supabase = createClient();
  const { data: vinculados } = await supabase
    .from("subrecetas")
    .select("insumo_id")
    .not("insumo_id", "is", null);
  const idsVinculados = (vinculados ?? [])
    .map((v) => v.insumo_id as string | null)
    .filter((id): id is string => !!id);

  let query = supabase
    .from("insumos")
    .select("id, articulo, referencia, coste, unidad_codigo")
    .eq("sede_id", sedeId)
    .ilike("articulo", "SUB.%")
    .order("articulo");

  if (idsVinculados.length > 0) {
    query = query.not("id", "in", `(${idsVinculados.join(",")})`);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((i) => ({
    id: i.id as string,
    articulo: i.articulo as string,
    referencia: i.referencia as string | null,
    coste: Number(i.coste),
    unidad_codigo: i.unidad_codigo as string | null,
  }));
}

/**
 * Próxima referencia "SUBnnn" libre para el maestro nuevo — mira las
 * referencias existentes con ese patrón y sugiere la siguiente, igual que
 * el "Siguiente disponible: SUB001 (editable)" de GastroCore. Es solo una
 * sugerencia editable, nunca se fuerza.
 */
export async function siguienteReferenciaSubDisponible(sedeId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("insumos")
    .select("referencia")
    .eq("sede_id", sedeId)
    .ilike("referencia", "SUB%");

  if (error || !data) return "SUB001";
  let max = 0;
  for (const fila of data) {
    const ref = ((fila.referencia as string | null) ?? "").trim();
    const m = /^SUB(\d+)$/i.exec(ref);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `SUB${String(max + 1).padStart(3, "0")}`;
}

/**
 * Crea la subreceta y todos sus ingredientes en un solo guardado — la usa
 * el armador de "Nueva subreceta" (SubrecetaForm). Antes de crear la
 * subreceta resuelve su insumo maestro: o enlaza uno "SUB." existente sin
 * usar (modo "vincular"), o crea uno nuevo con la referencia/subfamilia
 * elegidas (modo "crear") — patrón maestro-calculadora igual que
 * GastroCore.
 */
export async function crearSubrecetaConIngredientes(datos: {
  sedeId: string;
  nombre: string;
  rendimiento: number | null;
  unidadRendimientoCodigo: string | null;
  desvioPct: number;
  maestro:
    | { modo: "vincular"; insumoId: string }
    | { modo: "crear"; referencia: string | null; subfamiliaId: string | null };
  lineas: {
    tipoItem: "insumo" | "subreceta";
    itemId: string;
    cantidad: number;
    unidadCodigo: string | null;
    mermaPct: number;
  }[];
}): Promise<{ id: string } | { error: string }> {
  const supabase = createClient();

  let insumoId: string;

  if (datos.maestro.modo === "vincular") {
    const { data: yaVinculada } = await supabase
      .from("subrecetas")
      .select("id")
      .eq("insumo_id", datos.maestro.insumoId)
      .maybeSingle();
    if (yaVinculada) {
      return { error: "Ese insumo maestro ya está vinculado a otra subreceta." };
    }
    insumoId = datos.maestro.insumoId;
  } else {
    const nombreUpper = datos.nombre.toUpperCase();
    const articulo = nombreUpper.startsWith("SUB.") ? nombreUpper : `SUB.${nombreUpper}`;
    const { data: insumo, error: errorInsumo } = await supabase
      .from("insumos")
      .insert({
        sede_id: datos.sedeId,
        articulo,
        referencia: datos.maestro.referencia,
        subfamilia_id: datos.maestro.subfamiliaId,
        coste: 0,
      })
      .select("id")
      .single();

    if (errorInsumo || !insumo) {
      return { error: `No se pudo crear el insumo maestro: ${errorInsumo?.message}` };
    }
    insumoId = insumo.id as string;
  }

  const { data: subreceta, error: errorSub } = await supabase
    .from("subrecetas")
    .insert({
      sede_id: datos.sedeId,
      insumo_id: insumoId,
      nombre: datos.nombre,
      rendimiento: datos.rendimiento,
      unidad_rendimiento_codigo: datos.unidadRendimientoCodigo,
      desvio_pct: datos.desvioPct,
    })
    .select("id")
    .single();

  if (errorSub || !subreceta) {
    return { error: `No se pudo crear la subreceta: ${errorSub?.message}` };
  }

  for (const [idx, linea] of datos.lineas.entries()) {
    await agregarLineaIngrediente({
      sedeId: datos.sedeId,
      subrecetaDuenaId: subreceta.id,
      tipoItem: linea.tipoItem,
      insumoId: linea.tipoItem === "insumo" ? linea.itemId : undefined,
      subrecetaId: linea.tipoItem === "subreceta" ? linea.itemId : undefined,
      cantidad: linea.cantidad,
      unidadCodigo: linea.unidadCodigo,
      mermaPct: linea.mermaPct,
      orden: idx + 1,
    });
  }

  await recalcularSubreceta(subreceta.id as string);

  return { id: subreceta.id as string };
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
