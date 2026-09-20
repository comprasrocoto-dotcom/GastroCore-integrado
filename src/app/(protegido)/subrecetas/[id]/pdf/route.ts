import { NextResponse } from "next/server";
import { obtenerSubreceta } from "@/lib/data/subrecetas";
import { listarIngredientesDeSubreceta } from "@/lib/data/ingredientes";
import { generarPdfSubreceta } from "@/lib/pdf/subreceta";

/**
 * Genera el PDF de una subreceta con los mismos datos que ya se ven en
 * `/subrecetas/[id]`. Usa el cliente de Supabase con la sesión del
 * usuario, así que respeta la misma RLS por sede de siempre.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const subreceta = await obtenerSubreceta(params.id);
  if (!subreceta) {
    return NextResponse.json({ error: "Subreceta no encontrada." }, { status: 404 });
  }

  const ingredientes = await listarIngredientesDeSubreceta(subreceta.id);

  const pdfBytes = await generarPdfSubreceta({ subreceta, ingredientes });

  const nombreArchivo = `subreceta-${subreceta.nombre.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
