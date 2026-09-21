import { NextResponse } from "next/server";
import { obtenerReceta } from "@/lib/data/recetas";
import { listarIngredientesDeReceta } from "@/lib/data/ingredientes";
import { calcularResumenCosteo } from "@/lib/costeo";
import { obtenerConfiguracionCosteo } from "@/lib/data/configuracion";
import { generarPdfReceta } from "@/lib/pdf/receta";

/**
 * Genera el PDF de una receta con los mismos datos y las mismas fórmulas
 * que ya usa `/recetas/[id]` (ver `lib/costeo.ts`) — no agrega ni cambia
 * ninguna regla de negocio, solo exporta a PDF lo que ya se ve en
 * pantalla. Usa el cliente de Supabase con la sesión del usuario, así que
 * respeta la misma RLS por sede de siempre.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const receta = await obtenerReceta(params.id);
  if (!receta) {
    return NextResponse.json({ error: "Receta no encontrada." }, { status: 404 });
  }

  const [ingredientes, config] = await Promise.all([
    listarIngredientesDeReceta(receta.id),
    obtenerConfiguracionCosteo(receta.sede_id),
  ]);

  const resumen = receta.precio_real
    ? calcularResumenCosteo(receta.costo_porcion, receta.precio_real, {
        fcObjetivo: config.fcObjetivo,
        iva: receta.iva,
      })
    : null;

  const costoBaseSinMerma = ingredientes.reduce((s, i) => s + i.costo_unitario * i.cantidad, 0);
  const costoConMerma = ingredientes.reduce((s, i) => s + i.costo_linea, 0);
  const costoPorMerma = costoConMerma - costoBaseSinMerma;
  const desvioMonto = receta.costo_total - costoConMerma;

  const pdfBytes = await generarPdfReceta({
    receta,
    ingredientes,
    resumen,
    costoBaseSinMerma,
    costoPorMerma,
    desvioMonto,
    foodCostObjetivo: config.fcObjetivo,
  });

  const nombreArchivo = `receta-${receta.nombre.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
