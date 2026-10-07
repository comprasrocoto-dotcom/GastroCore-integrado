import "server-only";
import { createClient } from "@/lib/supabase/server";
import { FC_OBJ, FC_OBJ_PANEL, INC } from "@/lib/costeo";

const CLAVE_COSTEO = "costeo";

export type ConfiguracionCosteo = {
  fcObjetivo: number;
  fcObjetivoPanel: number;
  iva: number;
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
