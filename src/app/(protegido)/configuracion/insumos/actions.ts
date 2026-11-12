"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUsuarioActual, esMaestro } from "@/lib/auth/usuario-actual";
import { leerFilasArchivoCosto } from "@/lib/excel/costos";
import {
  armarPlanReemplazoSede,
  aplicarPlanReemplazoMarca,
  desactivarInsumosMarca,
  type PlanReemplazoSede,
  type ItemPlanReemplazo,
} from "@/lib/data/reemplazar-insumos";
import { listarMarcasConSedes } from "@/lib/data/marcas";

/**
 * Reemplazar o borrar insumos de una marca entera es, junto con eliminar
 * una marca/sede, de las operaciones más delicadas del sistema — afecta
 * de una sola vez a todas las sedes de una marca (ver el caso real de
 * 123 WOK, con más de 1.500 insumos cargados, documentado en
 * `marcas/actions.ts`). Por eso se exige Admin multi-marca, igual que
 * crear/eliminar marcas y sedes.
 */
async function exigirAdminMultiMarca() {
  const usuario = await getUsuarioActual();
  if (!usuario || !esMaestro(usuario)) {
    throw new Error("Solo el Admin multi-marca puede reemplazar o borrar insumos por marca.");
  }
  return usuario;
}

export type EstadoReemplazo = {
  error: string | null;
  marcaId: string | null;
  marcaNombre: string | null;
  planes: PlanReemplazoSede[] | null;
};

/**
 * Paso 1: lee los archivos subidos (uno por sede, los que se hayan
 * elegido) y arma el plan de cada sede — sin tocar la base de datos
 * todavía, hace falta confirmar en pantalla antes de aplicar nada.
 */
export async function previsualizarReemplazo(
  _estadoPrevio: EstadoReemplazo,
  formData: FormData
): Promise<EstadoReemplazo> {
  await exigirAdminMultiMarca();

  const marcaId = String(formData.get("marca_id") ?? "");
  if (!marcaId) {
    return { error: "Elegí una marca.", marcaId: null, marcaNombre: null, planes: null };
  }

  const marcas = await listarMarcasConSedes();
  const marca = marcas.find((m) => m.id === marcaId);
  if (!marca) {
    return { error: "No se encontró esa marca.", marcaId: null, marcaNombre: null, planes: null };
  }

  const planes: PlanReemplazoSede[] = [];
  let huboAlgunArchivo = false;

  for (const sede of marca.sedes) {
    const archivo = formData.get(`archivo_${sede.id}`);
    if (!(archivo instanceof File) || archivo.size === 0) continue;
    huboAlgunArchivo = true;

    let filas;
    try {
      const buffer = await archivo.arrayBuffer();
      filas = await leerFilasArchivoCosto(buffer);
    } catch {
      return {
        error: `No se pudo leer el archivo de "${sede.nombre}". ¿Es un Excel (.xlsx) válido?`,
        marcaId,
        marcaNombre: marca.nombre,
        planes: null,
      };
    }

    if (filas.length === 0) continue;

    const plan = await armarPlanReemplazoSede(sede.id, sede.nombre, filas);
    planes.push(plan);
  }

  if (!huboAlgunArchivo) {
    return {
      error: "Subí al menos un archivo (para alguna de las sedes de la marca).",
      marcaId,
      marcaNombre: marca.nombre,
      planes: null,
    };
  }

  return { error: null, marcaId, marcaNombre: marca.nombre, planes };
}

/**
 * Paso 2: aplica de verdad el plan ya mostrado en pantalla — llega como
 * JSON en un campo oculto del formulario de confirmación, no se vuelve a
 * leer ningún archivo ni a recalcular el cruce.
 */
export async function aplicarReemplazo(formData: FormData) {
  const usuario = await exigirAdminMultiMarca();

  const marcaId = String(formData.get("marca_id") ?? "");
  const planesCrudo = String(formData.get("planes_json") ?? "");
  if (!marcaId || !planesCrudo) {
    redirect(`/configuracion/insumos?error=${encodeURIComponent("Faltan datos para aplicar la carga.")}`);
    return;
  }

  let sedes: { sedeId: string; items: ItemPlanReemplazo[] }[] = [];
  try {
    const planes = JSON.parse(planesCrudo) as PlanReemplazoSede[];
    sedes = planes.map((p) => ({
      sedeId: p.sedeId,
      items: p.items.filter((i) => i.accion !== "sin_cambio"),
    }));
  } catch {
    redirect(`/configuracion/insumos?error=${encodeURIComponent("No se pudo leer el plan a aplicar.")}`);
    return;
  }

  const resultado = await aplicarPlanReemplazoMarca(usuario.id, sedes);

  revalidatePath("/insumos");
  revalidatePath("/recetas");
  revalidatePath("/subrecetas");
  revalidatePath("/recetario");
  revalidatePath("/configuracion");
  revalidatePath("/configuracion/insumos");

  redirect(
    `/configuracion/insumos?marca=${marcaId}&aplicado=1&actualizados=${resultado.totalActualizados}&creados=${resultado.totalCreados}`
  );
}

/**
 * "Borrar insumos de una marca": en realidad los desactiva (ver el
 * porqué en `lib/data/reemplazar-insumos.ts`). Exige escribir el nombre
 * exacto de la marca como confirmación — no alcanza con un simple
 * aceptar/cancelar, porque esto puede afectar a miles de insumos de una
 * sola vez y no es fácil de deshacer.
 */
export async function borrarInsumosMarca(formData: FormData) {
  await exigirAdminMultiMarca();

  const marcaId = String(formData.get("marca_id") ?? "");
  const confirmacion = String(formData.get("confirmacion") ?? "").trim();

  const marcas = await listarMarcasConSedes();
  const marca = marcas.find((m) => m.id === marcaId);

  if (!marca || confirmacion !== marca.nombre) {
    redirect(
      `/configuracion/insumos?marca=${marcaId}&error=${encodeURIComponent(
        !marca
          ? "No se encontró esa marca."
          : "Para borrar tenés que escribir el nombre de la marca exactamente igual."
      )}`
    );
    return;
  }

  const sedeIds = marca.sedes.map((s) => s.id);
  const resultado = await desactivarInsumosMarca(sedeIds);

  revalidatePath("/insumos");
  revalidatePath("/recetas");
  revalidatePath("/subrecetas");
  revalidatePath("/recetario");
  revalidatePath("/configuracion");
  revalidatePath("/configuracion/insumos");

  redirect(`/configuracion/insumos?marca=${marcaId}&borrados=${resultado.desactivados}`);
}
