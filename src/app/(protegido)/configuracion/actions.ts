"use server";

import { revalidatePath } from "next/cache";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import {
  guardarConfiguracionCosteo,
  guardarClavesRecetario,
  guardarIdentidad,
} from "@/lib/data/configuracion";
import { createClient } from "@/lib/supabase/server";
import { listarInsumos, type InsumoFila } from "@/lib/data/insumos";
import { recalcularReceta, recalcularSubreceta } from "@/lib/data/ingredientes";
import { TEMAS_RECETARIO } from "@/lib/temas-recetario";

export async function guardarConfiguracion(formData: FormData) {
  const sedeId = String(formData.get("sede_id") ?? "");
  if (!sedeId) return;

  const fcObjetivoPct = Number(formData.get("fc_objetivo") ?? 0);
  const fcObjetivoPanelPct = Number(formData.get("fc_objetivo_panel") ?? 0);
  const ivaPct = Number(formData.get("iva") ?? 0);
  const alertaInsumoRaw = String(formData.get("alerta_insumo") ?? "").trim();
  const alertaInsumoPct = alertaInsumoRaw === "" ? null : Number(alertaInsumoRaw);

  // Validación básica — mismos rangos razonables que ya usan los
  // porcentajes en el resto de la app (merma, desvío, etc.).
  if (!Number.isFinite(fcObjetivoPct) || fcObjetivoPct <= 0 || fcObjetivoPct >= 100) return;
  if (!Number.isFinite(fcObjetivoPanelPct) || fcObjetivoPanelPct <= 0 || fcObjetivoPanelPct >= 100) return;
  if (!Number.isFinite(ivaPct) || ivaPct < 0 || ivaPct >= 100) return;
  if (alertaInsumoPct !== null && (!Number.isFinite(alertaInsumoPct) || alertaInsumoPct <= 0 || alertaInsumoPct >= 1000)) {
    return;
  }

  const usuario = await getUsuarioActual();

  await guardarConfiguracionCosteo(sedeId, usuario?.id ?? null, {
    fcObjetivo: fcObjetivoPct / 100,
    fcObjetivoPanel: fcObjetivoPanelPct / 100,
    iva: ivaPct / 100,
    alertaInsumoPct: alertaInsumoPct === null ? null : alertaInsumoPct / 100,
  });

  revalidatePath("/configuracion");
  revalidatePath("/recetas");
  revalidatePath("/insumos");
}

export async function guardarClaves(formData: FormData) {
  const sedeId = String(formData.get("sede_id") ?? "");
  if (!sedeId) return;

  const claveBar = String(formData.get("clave_bar") ?? "").trim();
  const claveCocina = String(formData.get("clave_cocina") ?? "").trim();

  const usuario = await getUsuarioActual();

  await guardarClavesRecetario(sedeId, usuario?.id ?? null, {
    bar: claveBar || null,
    cocina: claveCocina || null,
  });

  revalidatePath("/configuracion");
  revalidatePath("/recetario");
}

export async function guardarEstiloRecetario(formData: FormData) {
  const sedeId = String(formData.get("sede_id") ?? "");
  const temaId = String(formData.get("tema_id") ?? "");
  if (!sedeId || !temaId) return;
  if (!TEMAS_RECETARIO.some((t) => t.id === temaId)) return;

  const usuario = await getUsuarioActual();
  await guardarIdentidad(sedeId, usuario?.id ?? null, temaId);

  revalidatePath("/configuracion");
  revalidatePath("/recetario");
}

/**
 * "Poner costos al día" (27/10): fuerza el recálculo oficial de costo de
 * todas las subrecetas y recetas de esta sede, llamando a las mismas
 * funciones (`recalcular_receta`/`recalcular_subreceta`, del lado de
 * Postgres) que ya se usan automáticamente cada vez que se guarda una
 * receta o subreceta — no inventa ninguna fórmula nueva. Subrecetas
 * primero, recetas después, porque una receta puede depender del costo
 * de una subreceta. No hace falta en el día a día (cada edición ya
 * recalcula sola); sirve como red de seguridad si algo quedó
 * desactualizado.
 */
export async function recalcularCostosSede(formData: FormData) {
  const sedeId = String(formData.get("sede_id") ?? "");
  if (!sedeId) return;

  const supabase = createClient();

  const { data: subrecetas } = await supabase
    .from("subrecetas")
    .select("id")
    .eq("sede_id", sedeId);

  for (const s of subrecetas ?? []) {
    await recalcularSubreceta(s.id as string);
  }

  const { data: recetas } = await supabase.from("recetas").select("id").eq("sede_id", sedeId);

  for (const r of recetas ?? []) {
    await recalcularReceta(r.id as string);
  }

  revalidatePath("/configuracion");
  revalidatePath("/recetas");
  revalidatePath("/subrecetas");
  revalidatePath("/recetario");
}

/**
 * Buscador liviano de insumos para el atajo de "Mermas estándar" en
 * Configuración — se llama directo desde el cliente (no es un <form>),
 * reusa `listarInsumos` tal cual la usa la pantalla de Insumos.
 */
export async function buscarInsumosParaMerma(
  sedeId: string,
  q: string
): Promise<InsumoFila[]> {
  if (!sedeId || !q.trim()) return [];
  const { insumos } = await listarInsumos(sedeId, { q, pagina: 1 });
  return insumos.slice(0, 8);
}

export async function actualizarMermaInsumo(insumoId: string, mermaPct: number) {
  if (!insumoId) return;
  if (!Number.isFinite(mermaPct) || mermaPct < 0 || mermaPct >= 100) return;

  const supabase = createClient();
  await supabase
    .from("insumos")
    .update({ merma_std: mermaPct / 100 })
    .eq("id", insumoId);

  revalidatePath("/configuracion");
  revalidatePath("/insumos");
}
