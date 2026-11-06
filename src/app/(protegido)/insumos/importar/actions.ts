"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { leerFilasArchivoCosto } from "@/lib/excel/costos";
import {
  armarPlanImportacion,
  aplicarPlanImportacion,
  type PlanImportacion,
  type ItemPlanImportacion,
} from "@/lib/data/importar-costos";

export type EstadoImportacion = {
  error: string | null;
  plan: PlanImportacion | null;
};

export async function previsualizarImportacion(
  _estadoPrevio: EstadoImportacion,
  formData: FormData
): Promise<EstadoImportacion> {
  const sedeId = String(formData.get("sede_id") ?? "");
  const archivo = formData.get("archivo");

  if (!sedeId) return { error: "Falta la sede.", plan: null };
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Elegí un archivo para subir.", plan: null };
  }

  let filas;
  try {
    const buffer = await archivo.arrayBuffer();
    filas = await leerFilasArchivoCosto(buffer);
  } catch {
    return { error: "No se pudo leer el archivo. ¿Es un Excel (.xlsx) válido?", plan: null };
  }

  if (filas.length === 0) return { error: "El archivo no tiene filas con artículo.", plan: null };

  const plan = await armarPlanImportacion(sedeId, filas);
  return { error: null, plan };
}

export async function aplicarImportacion(formData: FormData) {
  const sedeId = String(formData.get("sede_id") ?? "");
  const itemsCrudo = String(formData.get("items_json") ?? "");

  if (!sedeId || !itemsCrudo) {
    redirect(`/insumos/importar?sede=${sedeId}&error=${encodeURIComponent("Faltan datos para aplicar la carga.")}`);
  }

  let items: ItemPlanImportacion[] = [];
  try {
    const parseado = JSON.parse(itemsCrudo) as ItemPlanImportacion[];
    items = parseado.filter(
      (item) => (item.accion === "actualizar" && !!item.insumoId) || item.accion === "crear"
    );
  } catch {
    redirect(`/insumos/importar?sede=${sedeId}&error=${encodeURIComponent("No se pudo leer el plan a aplicar.")}`);
  }

  const usuario = await getUsuarioActual();
  const resultado = await aplicarPlanImportacion(sedeId, usuario?.id ?? null, items);

  revalidatePath("/insumos");
  revalidatePath("/recetas");
  revalidatePath("/subrecetas");
  revalidatePath("/recetario");
  revalidatePath("/configuracion");

  redirect(
    `/insumos/importar?sede=${sedeId}&aplicado=1&actualizados=${resultado.actualizados}&creados=${resultado.creados}`
  );
}
