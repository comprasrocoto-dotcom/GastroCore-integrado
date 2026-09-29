import { NextResponse } from "next/server";
import { listarRecetas } from "@/lib/data/recetas";
import { listarSubrecetas } from "@/lib/data/subrecetas";
import { listarIngredientesDeReceta, listarIngredientesDeSubreceta } from "@/lib/data/ingredientes";
import { obtenerFichaPorReceta } from "@/lib/data/fichas";
import { getSedesVisibles } from "@/lib/data/sedes";
import { generarExcelRecetario } from "@/lib/excel/recetario";

/**
 * Descarga el recetario completo de una sede en un solo Excel (recetas +
 * subrecetas, con el detalle de sus ingredientes y costos, y — si se pide
 * — las fichas técnicas de las recetas). Mismos datos y mismas fórmulas
 * que ya se ven en `/recetas` y `/subrecetas`, no inventa ni recalcula
 * nada. Usa el cliente de Supabase con la sesión del usuario, así que
 * respeta la misma RLS por sede de siempre.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sedeId = url.searchParams.get("sede") ?? "";
  const incluirFichas = url.searchParams.get("fichas") === "1";
  const soloActivas = url.searchParams.get("activas") === "1";

  if (!sedeId) {
    return NextResponse.json({ error: "Falta la sede." }, { status: 400 });
  }

  const sedesVisibles = await getSedesVisibles();
  const sede = sedesVisibles.find((s) => s.id === sedeId);
  if (!sede) {
    return NextResponse.json({ error: "Sede no encontrada." }, { status: 404 });
  }

  const [todasRecetas, todasSubrecetas] = await Promise.all([
    listarRecetas(sedeId),
    listarSubrecetas(sedeId),
  ]);

  const recetas = soloActivas ? todasRecetas.filter((r) => r.activo) : todasRecetas;
  const subrecetas = soloActivas ? todasSubrecetas.filter((s) => s.activo) : todasSubrecetas;

  const [ingredientesPorReceta, ingredientesPorSubreceta] = await Promise.all([
    Promise.all(recetas.map((r) => listarIngredientesDeReceta(r.id))),
    Promise.all(subrecetas.map((s) => listarIngredientesDeSubreceta(s.id))),
  ]);

  const ingredientesRecetas = recetas.flatMap((r, idx) =>
    ingredientesPorReceta[idx].map((i) => ({
      duenoNombre: r.nombre,
      tipo_item: i.tipo_item,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      unidad_codigo: i.unidad_codigo,
      merma_pct: i.merma_pct,
      costo_unitario: i.costo_unitario,
      costo_linea: i.costo_linea,
    }))
  );

  const ingredientesSubrecetas = subrecetas.flatMap((s, idx) =>
    ingredientesPorSubreceta[idx].map((i) => ({
      duenoNombre: s.nombre,
      tipo_item: i.tipo_item,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      unidad_codigo: i.unidad_codigo,
      merma_pct: i.merma_pct,
      costo_unitario: i.costo_unitario,
      costo_linea: i.costo_linea,
    }))
  );

  let fichas: { recetaNombre: string; preparacion: string | null; emplatado: string | null; notas: string | null; tiempo_min: number | null; gramaje_porcion: number | null }[] | null = null;
  if (incluirFichas) {
    const fichasCrudas = await Promise.all(recetas.map((r) => obtenerFichaPorReceta(r.id)));
    fichas = recetas.map((r, idx) => ({
      recetaNombre: r.nombre,
      preparacion: fichasCrudas[idx]?.preparacion ?? null,
      emplatado: fichasCrudas[idx]?.emplatado ?? null,
      notas: fichasCrudas[idx]?.notas ?? null,
      tiempo_min: fichasCrudas[idx]?.tiempo_min ?? null,
      gramaje_porcion: fichasCrudas[idx]?.gramaje_porcion ?? null,
    }));
  }

  const buffer = await generarExcelRecetario({
    sedeNombre: sede.nombre,
    recetas,
    subrecetas,
    ingredientesRecetas,
    ingredientesSubrecetas,
    fichas,
  });

  const nombreArchivo = `recetario-${sede.nombre.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.xlsx`;

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
