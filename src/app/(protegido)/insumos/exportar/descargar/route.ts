import { NextResponse } from "next/server";
import { listarInsumosParaExportar, listarSubfamilias } from "@/lib/data/insumos";
import { getSedesVisibles } from "@/lib/data/sedes";
import { generarExcelInsumos } from "@/lib/excel/insumos";

/**
 * Descarga el listado de Insumos en Excel (23/11, pedido de Mariluz),
 * respetando la búsqueda y los filtros (subfamilia, Centro de costo) que
 * estén activos en pantalla — mismos datos que ya se ven en `/insumos`, en
 * un solo Excel con todas las filas en vez de 50 por página. Usa el
 * cliente de Supabase con la sesión del usuario, así que respeta la misma
 * RLS por sede de siempre.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sedeId = url.searchParams.get("sede") ?? "";
  const q = url.searchParams.get("q") ?? undefined;
  const subfamiliaId = url.searchParams.get("subfamilia") ?? undefined;
  const centroCosto = url.searchParams.get("centrocosto") ?? undefined;

  if (!sedeId) {
    return NextResponse.json({ error: "Falta la sede." }, { status: 400 });
  }

  const sedesVisibles = await getSedesVisibles();
  const sede = sedesVisibles.find((s) => s.id === sedeId);
  if (!sede) {
    return NextResponse.json({ error: "Sede no encontrada." }, { status: 404 });
  }

  const [insumos, subfamilias] = await Promise.all([
    listarInsumosParaExportar(sedeId, { q, subfamiliaId, centroCosto }),
    subfamiliaId ? listarSubfamilias(sedeId) : Promise.resolve([]),
  ]);

  const detalleFiltros = [
    q ? `búsqueda "${q}"` : null,
    subfamiliaId ? `subfamilia "${subfamilias.find((s) => s.id === subfamiliaId)?.nombre ?? subfamiliaId}"` : null,
    centroCosto ? `Centro de costo "${centroCosto}"` : null,
  ].filter((p): p is string => p !== null);

  const buffer = await generarExcelInsumos({ sedeNombre: sede.nombre, insumos, detalleFiltros });

  const fecha = new Date().toISOString().slice(0, 10);
  const nombreArchivo = `Gastro Central - Insumos - ${sede.nombre} - ${fecha}.xlsx`.replace(/[\\/:*?"<>|]/g, "-");
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
