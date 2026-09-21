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
