"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  armarPlanEnvio,
  aplicarPlanEnvio,
  type PlanEnvio,
  type ItemPlanEnvio,
} from "@/lib/data/enviar-insumos";

export type EstadoEnvio = {
  error: string | null;
  plan: PlanEnvio | null;
};

/**
 * Paso 1: arma el plan (qué se va a crear en la sede destino, qué ya
 * existe y no se va a tocar) SIN escribir nada en la base todavía — hace
 * falta confirmar en pantalla antes de aplicar nada de verdad.
 */
export async function previsualizarEnvio(
  _estadoPrevio: EstadoEnvio,
  formData: FormData
): Promise<EstadoEnvio> {
  const sedeOrigenId = String(formData.get("sede_origen_id") ?? "");
  const sedeDestinoId = String(formData.get("sede_destino_id") ?? "");
  const insumoIds = String(formData.get("insumo_ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!sedeOrigenId || !sedeDestinoId) {
    return { error: "Falta elegir la sede destino.", plan: null };
  }
  if (sedeOrigenId === sedeDestinoId) {
    return { error: "La sede destino tiene que ser distinta a la de origen.", plan: null };
  }
  if (insumoIds.length === 0) {
    return { error: "No hay insumos seleccionados.", plan: null };
  }

  const plan = await armarPlanEnvio(sedeOrigenId, sedeDestinoId, insumoIds);
  return { error: null, plan };
}

/**
 * Paso 2: aplica de verdad el plan que ya se mostró en pantalla — llega
 * como JSON en un campo oculto del formulario de confirmación (ya
 * filtrado a solo los items que se van a crear), no se vuelve a calcular
 * el cruce contra la sede destino.
 */
export async function aplicarEnvio(formData: FormData) {
  const sedeOrigenId = String(formData.get("sede_origen_id") ?? "");
  const sedeDestinoId = String(formData.get("sede_destino_id") ?? "");
  const itemsCrudo = String(formData.get("items_json") ?? "");

  if (!sedeDestinoId || !itemsCrudo) {
    redirect(
      `/insumos/enviar?origen=${sedeOrigenId}&error=${encodeURIComponent("Faltan datos para aplicar el envío.")}`
    );
  }

  let items: ItemPlanEnvio[] = [];
  try {
    items = JSON.parse(itemsCrudo) as ItemPlanEnvio[];
  } catch {
    redirect(
      `/insumos/enviar?origen=${sedeOrigenId}&error=${encodeURIComponent("No se pudo leer el plan a aplicar.")}`
    );
  }

  const resultado = await aplicarPlanEnvio(sedeDestinoId, items);

  revalidatePath("/insumos");

  redirect(`/insumos?sede=${sedeOrigenId}&enviado=1&creados=${resultado.creados}`);
}
