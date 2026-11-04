import { NextResponse } from "next/server";
import { listarInsumos } from "@/lib/data/insumos";
import { listarFamiliasConSubfamilias } from "@/lib/data/familias";
import { listarSubrecetas } from "@/lib/data/subrecetas";
import { listarRecetas } from "@/lib/data/recetas";
import { getSedesVisibles } from "@/lib/data/sedes";
import { generarExcelRespaldo } from "@/lib/excel/respaldo";

/**
 * "Respaldo de la base" (27/10) — descarga un Excel con los datos
 * maestros de una sede (insumos, familias, subrecetas, recetas). Usa el
 * cliente de Supabase con la sesión del usuario, así que respeta la
 * misma RLS por sede de siempre.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sedeId = url.searchParams.get("sede") ?? "";

  if (!sedeId) {
    return NextResponse.json({ error: "Falta la sede." }, { status: 400 });
  }

  const sedesVisibles = await getSedesVisibles();
  const sede = sedesVisibles.find((s) => s.id === sedeId);
  if (!sede) {
    return NextResponse.json({ error: "Sede no encontrada." }, { status: 404 });
  }

  // listarInsumos pagina de a 50 — se recorre todas las páginas para el
  // respaldo completo.
  const insumos: Awaited<ReturnType<typeof listarInsumos>>["insumos"] = [];
  let pagina = 1;
  for (;;) {
    const res = await listarInsumos(sedeId, { pagina });
    insumos.push(...res.insumos);
    if (pagina >= res.totalPaginas) break;
    pagina += 1;
  }

  const [familias, subrecetas, recetas] = await Promise.all([
    listarFamiliasConSubfamilias(sedeId),
    listarSubrecetas(sedeId),
    listarRecetas(sedeId),
  ]);

  const buffer = await generarExcelRespaldo({
    sedeNombre: sede.nombre,
    insumos: insumos.map((i) => ({
      referencia: i.referencia,
      articulo: i.articulo,
      subarticulo: i.subarticulo,
      familia_nombre: i.familia_nombre,
      subfamilia_nombre: i.subfamilia_nombre,
      unidad_codigo: i.unidad_codigo,
      coste: i.coste,
      merma_std: i.merma_std,
      activo: i.activo,
    })),
    familias: familias.map((f) => ({
      nombre: f.nombre,
      tipo: f.tipo,
      centrocosto: f.centrocosto,
      fc_objetivo: f.fcObjetivo,
      activo: f.activo,
    })),
    subrecetas: subrecetas.map((s) => ({
      nombre: s.nombre,
      rendimiento: s.rendimiento,
      unidad_rendimiento_codigo: s.unidad_rendimiento_codigo,
      costo_unitario: s.costo_unitario,
      activo: s.activo,
    })),
    recetas: recetas.map((r) => ({
      nombre: r.nombre,
      familia_nombre: r.familia_nombre,
      rendimiento: r.rendimiento,
      unidad_rendimiento_codigo: r.unidad_rendimiento_codigo,
      costo_porcion: r.costo_porcion,
      precio_real: r.precio_real,
      activo: r.activo,
    })),
  });

  const nombreArchivo = `respaldo-${sede.nombre.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.xlsx`;

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
