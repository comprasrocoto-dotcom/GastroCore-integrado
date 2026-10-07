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
 * pantalla, con el mismo diseño de ficha que usa el equipo hoy (ver
 * `lib/pdf/receta.ts`). Usa el cliente de Supabase con la sesión del
 * usuario, así que respeta la misma RLS por sede de siempre.
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

  // Mismo criterio que `/recetas/[id]`: usa el food cost objetivo propio
  // de la familia de la receta si tiene uno cargado; si no, el de
  // Configuración (la sede).
  const resumen = receta.precio_real
    ? calcularResumenCosteo(receta.costo_porcion, receta.precio_real, {
        fcObjetivo: receta.familia_fc_objetivo ?? config.fcObjetivo,
        iva: receta.iva,
      })
    : null;

  // "Costo total de la preparación" = la suma de las líneas de ingredientes
  // (ya con la merma de cada línea aplicada), sin el desvío de mercancía —
  // el mismo número que ya se ve como "Costo de ingredientes" en el ticket
  // de `/recetas/[id]`.
  const costoTotalPreparacion = ingredientes.reduce((s, i) => s + i.costo_linea, 0);

  const pdfBytes = await generarPdfReceta({
    receta,
    ingredientes,
    resumen,
    costoTotalPreparacion,
  });

  const nombreArchivo = `receta-${receta.nombre.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
