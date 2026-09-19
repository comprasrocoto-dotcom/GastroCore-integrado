"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { obtenerInsumo } from "@/lib/data/insumos";

export type EstadoInsumo = { error: string | null };

function leerNumero(formData: FormData, campo: string): number {
  const valor = Number(formData.get(campo));
  return Number.isFinite(valor) ? valor : 0;
}

export async function crearInsumo(
  _estadoPrevio: EstadoInsumo,
  formData: FormData
): Promise<EstadoInsumo> {
  const sedeId = String(formData.get("sede_id") ?? "");
  const articulo = String(formData.get("articulo") ?? "").trim();

  if (!sedeId || !articulo) {
    return { error: "Falta la sede o el nombre del artículo." };
  }

  const supabase = createClient();
  const { error } = await supabase.from("insumos").insert({
    sede_id: sedeId,
    articulo,
    subarticulo: String(formData.get("subarticulo") ?? "").trim() || null,
    subfamilia_id: String(formData.get("subfamilia_id") ?? "") || null,
    unidad_codigo: String(formData.get("unidad_codigo") ?? "") || null,
    coste: leerNumero(formData, "coste"),
    referencia: String(formData.get("referencia") ?? "").trim() || null,
  });

  if (error) {
    return { error: `No se pudo crear el insumo: ${error.message}` };
  }

  revalidatePath("/insumos");
  redirect(`/insumos?sede=${sedeId}`);
}

export async function actualizarInsumo(
  _estadoPrevio: EstadoInsumo,
  formData: FormData
): Promise<EstadoInsumo> {
  const id = String(formData.get("id") ?? "");
  const sedeId = String(formData.get("sede_id") ?? "");
  const articulo = String(formData.get("articulo") ?? "").trim();
  const nuevoCoste = leerNumero(formData, "coste");
  const motivo = String(formData.get("motivo") ?? "").trim() || null;

  if (!id || !articulo) {
    return { error: "Falta el nombre del artículo." };
  }

  const supabase = createClient();
  const usuario = await getUsuarioActual();
  const insumoActual = await obtenerInsumo(id);

  const { error } = await supabase
    .from("insumos")
    .update({
      articulo,
      subarticulo: String(formData.get("subarticulo") ?? "").trim() || null,
      subfamilia_id: String(formData.get("subfamilia_id") ?? "") || null,
      unidad_codigo: String(formData.get("unidad_codigo") ?? "") || null,
      coste: nuevoCoste,
      referencia: String(formData.get("referencia") ?? "").trim() || null,
      activo: formData.get("activo") === "on",
    })
    .eq("id", id);

  if (error) {
    return { error: `No se pudo guardar: ${error.message}` };
  }

  // Si cambió el costo, dejamos registro en precios_historicos — igual que
  // hacía GastroCore, para poder ver la evolución de precio de cada insumo.
  if (insumoActual && insumoActual.coste !== nuevoCoste) {
    await supabase.from("precios_historicos").insert({
      sede_id: sedeId || insumoActual.sede_id,
      insumo_id: id,
      coste: nuevoCoste,
      coste_anterior: insumoActual.coste,
      diferencia: nuevoCoste - insumoActual.coste,
      motivo,
      usuario_id: usuario?.id ?? null,
    });
  }

  revalidatePath("/insumos");
  redirect(`/insumos?sede=${sedeId}`);
}
