import "server-only";
import { createClient } from "@/lib/supabase/server";
import { FC_OBJ, FC_OBJ_PANEL, INC } from "@/lib/costeo";

const CLAVE_COSTEO = "costeo";

export type ConfiguracionCosteo = {
  fcObjetivo: number;
  fcObjetivoPanel: number;
  iva: number;
  /**
   * Umbral para la "alerta roja" de Insumos (27/10): si el último cambio
   * de precio de un insumo supera este % (en cualquier sentido), se
   * resalta en la lista de Insumos. `null` = alerta desactivada, no
   * resalta nada (valor por defecto para no sorprender a nadie).
   */
  alertaInsumoPct: number | null;
};

/**
 * Valores que usaba `lib/costeo.ts` como constantes fijas antes de existir
 * esta pantalla — se mantienen como valor por defecto para cualquier sede
 * que todavía no guardó su propia fila en `configuracion`, así ninguna
 * sede cambia de comportamiento hasta que alguien la edite a propósito.
 */
export const CONFIGURACION_COSTEO_DEFECTO: ConfiguracionCosteo = {
  fcObjetivo: FC_OBJ,
  fcObjetivoPanel: FC_OBJ_PANEL,
  iva: INC,
  alertaInsumoPct: null,
};

/**
 * Lee la configuración de costeo de una sede desde `configuracion`
 * (clave "costeo"). Sin fila guardada todavía, devuelve los valores por
 * defecto de arriba.
 */
export async function obtenerConfiguracionCosteo(
  sedeId: string
): Promise<ConfiguracionCosteo> {
  const supabase = createClient();
  const { data } = await supabase
    .from("configuracion")
    .select("valor")
    .eq("clave", CLAVE_COSTEO)
    .eq("sede_id", sedeId)
    .maybeSingle();

  const valor = (data?.valor ?? {}) as Partial<ConfiguracionCosteo>;
  return {
    fcObjetivo:
      typeof valor.fcObjetivo === "number"
        ? valor.fcObjetivo
        : CONFIGURACION_COSTEO_DEFECTO.fcObjetivo,
    fcObjetivoPanel:
      typeof valor.fcObjetivoPanel === "number"
        ? valor.fcObjetivoPanel
        : CONFIGURACION_COSTEO_DEFECTO.fcObjetivoPanel,
    iva:
      typeof valor.iva === "number" ? valor.iva : CONFIGURACION_COSTEO_DEFECTO.iva,
    alertaInsumoPct:
      typeof valor.alertaInsumoPct === "number" ? valor.alertaInsumoPct : null,
  };
}

export async function guardarConfiguracionCosteo(
  sedeId: string,
  usuarioId: string | null,
  datos: ConfiguracionCosteo
) {
  const supabase = createClient();
  return supabase.from("configuracion").upsert(
    {
      clave: CLAVE_COSTEO,
      sede_id: sedeId,
      valor: datos,
      actualizado_por: usuarioId,
    },
    { onConflict: "clave,sede_id" }
  );
}

const CLAVE_CLAVES_RECETARIO = "claves_recetario";

export type ClavesRecetario = {
  bar: string | null;
  cocina: string | null;
};

/**
 * Claves (PIN) para entrar al Recetario filtrado por área — Bar o Cocina
 * (`familias.centrocosto`). Mientras una sede no tenga clave guardada acá,
 * el Recetario de esa sede se sigue viendo sin pedir nada, igual que
 * siempre — el candado solo se activa para una sede el día que alguien
 * carga una clave en Configuración.
 */
export async function obtenerClavesRecetario(sedeId: string): Promise<ClavesRecetario> {
  const supabase = createClient();
  const { data } = await supabase
    .from("configuracion")
    .select("valor")
    .eq("clave", CLAVE_CLAVES_RECETARIO)
    .eq("sede_id", sedeId)
    .maybeSingle();

  const valor = (data?.valor ?? {}) as Partial<ClavesRecetario>;
  return {
    bar: typeof valor.bar === "string" && valor.bar.trim() ? valor.bar.trim() : null,
    cocina: typeof valor.cocina === "string" && valor.cocina.trim() ? valor.cocina.trim() : null,
  };
}

export async function guardarClavesRecetario(
  sedeId: string,
  usuarioId: string | null,
  datos: ClavesRecetario
) {
  const supabase = createClient();
  return supabase.from("configuracion").upsert(
    {
      clave: CLAVE_CLAVES_RECETARIO,
      sede_id: sedeId,
      valor: datos,
      actualizado_por: usuarioId,
    },
    { onConflict: "clave,sede_id" }
  );
}

const CLAVE_IDENTIDAD = "identidad";

/**
 * "Estilo del recetario" (27/10): cada sede elige uno de los estilos de
 * `lib/temas-recetario.ts` para el Recetario público. No cambia ninguna
 * fórmula ni ningún dato, solo el color con el que se ve. Sin estilo
 * guardado todavía, se usa `TEMA_DEFECTO` ("rocoto").
 */
export async function obtenerIdentidad(sedeId: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("configuracion")
    .select("valor")
    .eq("clave", CLAVE_IDENTIDAD)
    .eq("sede_id", sedeId)
    .maybeSingle();

  const valor = (data?.valor ?? {}) as { temaId?: string };
  return typeof valor.temaId === "string" ? valor.temaId : null;
}

export async function guardarIdentidad(
  sedeId: string,
  usuarioId: string | null,
  temaId: string
) {
  const supabase = createClient();
  return supabase.from("configuracion").upsert(
    {
      clave: CLAVE_IDENTIDAD,
      sede_id: sedeId,
      valor: { temaId },
      actualizado_por: usuarioId,
    },
    { onConflict: "clave,sede_id" }
  );
}
