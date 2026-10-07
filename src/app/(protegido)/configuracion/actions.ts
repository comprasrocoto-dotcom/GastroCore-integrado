"use server";

import { revalidatePath } from "next/cache";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { guardarConfiguracionCosteo, guardarClavesRecetario } from "@/lib/data/configuracion";

export async function guardarConfiguracion(formData: FormData) {
  const sedeId = String(formData.get("sede_id") ?? "");
  if (!sedeId) return;

  const fcObjetivoPct = Number(formData.get("fc_objetivo") ?? 0);
  const fcObjetivoPanelPct = Number(formData.get("fc_objetivo_panel") ?? 0);
  const ivaPct = Number(formData.get("iva") ?? 0);

  // Validación básica — mismos rangos razonables que ya usan los
  // porcentajes en el resto de la app (merma, desvío, etc.).
  if (!Number.isFinite(fcObjetivoPct) || fcObjetivoPct <= 0 || fcObjetivoPct >= 100) return;
  if (!Number.isFinite(fcObjetivoPanelPct) || fcObjetivoPanelPct <= 0 || fcObjetivoPanelPct >= 100) return;
  if (!Number.isFinite(ivaPct) || ivaPct < 0 || ivaPct >= 100) return;

  const usuario = await getUsuarioActual();

  await guardarConfiguracionCosteo(sedeId, usuario?.id ?? null, {
    fcObjetivo: fcObjetivoPct / 100,
    fcObjetivoPanel: fcObjetivoPanelPct / 100,
    iva: ivaPct / 100,
  });

  revalidatePath("/configuracion");
  revalidatePath("/recetas");
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
