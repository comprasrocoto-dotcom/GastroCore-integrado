import Link from "next/link";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";

/**
 * Pantalla para descargar el recetario completo (recetas + subrecetas, con
 * el detalle de sus ingredientes y costos) en un solo Excel — pensada para
 * mandar por correo o abrir fuera de Gastro Central. El PDF de una
 * preparación sigue siendo por receta, desde su propio detalle (botón
 * "PDF"): esta pantalla no genera un PDF del recetario completo, solo
 * Excel — así lo pidió Mariluz.
 */
export default async function ExportarRecetarioPage({
  searchParams,
}: {
  searchParams: { sede?: string };
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  const sedesVisibles = await getSedesVisibles();
  const sedeActiva = resolverSedeActiva(usuario, sedesVisibles, searchParams.sede);
  if (!sedeActiva) return <p style={{ color: "var(--muted)" }}>No hay ninguna sede disponible.</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow">{sedeActiva.marca_nombre} / {sedeActiva.nombre}</p>
          <h1 className="text-xl font-semibold">Exportar recetario</h1>
        </div>
        <Link href={`/recetas?sede=${sedeActiva.id}`} className="text-sm text-slate-500 hover:underline">
          Volver
        </Link>
      </div>

      <div className="max-w-xl">
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-lg text-white"
            style={{ background: "#2563EB" }}
          >
            ⬇
          </span>
          <div>
            <h2 className="text-lg font-semibold">Exportar a Excel</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              La relación completa: cada receta y subreceta con el detalle de sus ingredientes,
              costos y — si querés — sus fichas técnicas.
            </p>
          </div>
        </div>

        <form
          action="/recetas/exportar/descargar"
          method="get"
          className="card mt-4 flex flex-col gap-3 p-4"
        >
          <input type="hidden" name="sede" value={sedeActiva.id} />

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="fichas" value="1" defaultChecked className="mt-0.5" />
            <span>
              Incluir <strong>fichas técnicas</strong> (preparación, uso y notas — solo texto)
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="activas" value="1" defaultChecked className="mt-0.5" />
            <span>
              Solo <strong>activas</strong> (desmarcalo para incluir las desactivadas)
            </span>
          </label>

          <button type="submit" className="btn-primary w-full justify-center">
            ⬇ Descargar Excel
          </button>
        </form>

        <p
          className="mt-3 rounded-lg px-3 py-2 text-xs"
          style={{ background: "rgba(37,99,235,0.06)", color: "var(--muted)" }}
        >
          💡 Para el PDF de una preparación: entrá a su detalle y usá el botón <strong>📥 PDF</strong>{" "}
          — se imprime limpia, sin botones ni menús.
        </p>
      </div>
    </div>
  );
}
