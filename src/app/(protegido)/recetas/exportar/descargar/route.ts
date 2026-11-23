import { NextResponse } from "next/server";
import { listarRecetas } from "@/lib/data/recetas";
import { listarSubrecetas } from "@/lib/data/subrecetas";
import { listarIngredientesDeReceta, listarIngredientesDeSubreceta } from "@/lib/data/ingredientes";
import { listarUnidades } from "@/lib/data/insumos";
import { getSedesVisibles } from "@/lib/data/sedes";
import { generarExcelRecetario } from "@/lib/excel/recetario";

/**
 * Descarga el recetario completo de una sede en un solo Excel (recetas +
 * subrecetas, con el detalle de sus ingredientes y costos). Mismos datos y
 * mismas fórmulas que ya se ven en `/recetas` y `/subrecetas`, no inventa
 * ni recalcula nada. Usa el cliente de Supabase con la sesión del usuario,
 * así que respeta la misma RLS por sede de siempre.
 *
 * Estructura calcada del GastroCore viejo (a pedido de Mariluz, 23/11):
 * Portada + un bloque por receta/subreceta en vez de tablas planas. El
 * checkbox "fichas técnicas" ya no agrega columnas acá (el Excel viejo
 * tampoco las tenía ahí) — solo cambia el texto de la Portada; la ficha de
 * cada receta se sigue descargando en PDF aparte, desde su propio detalle.
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

  const unidades = await listarUnidades();
  const unidadesPorCodigo: Record<string, string> = {};
  unidades.forEach((u) => {
    unidadesPorCodigo[u.codigo] = u.nombre;
  });

  const buffer = await generarExcelRecetario({
    sedeNombre: sede.nombre,
    recetas,
    subrecetas,
    ingredientesRecetas,
    ingredientesSubrecetas,
    unidadesPorCodigo,
    incluyeFichas: incluirFichas,
    soloActivas,
  });

  const fecha = new Date().toISOString().slice(0, 10);
  const nombreArchivo = `Gastro Central - Recetario completo - ${sede.nombre} - ${fecha}.xlsx`.replace(/[\\/:*?"<>|]/g, "-");
  // El nombre de la sede puede traer tildes/ñ: se manda un nombre ASCII de
  // respaldo (`filename`) y el real codificado (`filename*`, RFC 5987) para
  // que los navegadores que sí lo soportan muestren el nombre completo.
  const nombreAscii = nombreArchivo.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "_");

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreAscii}"; filename*=UTF-8''${encodeURIComponent(nombreArchivo)}`,
    },
  });
}
