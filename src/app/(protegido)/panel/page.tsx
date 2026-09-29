import Link from "next/link";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";

/**
 * Panel ejecutivo — pantalla placeholder.
 *
 * Todavía no se construyó el contenido real (los indicadores, gráficos y
 * comparaciones que debe mostrar) porque esa es una decisión de negocio que
 * tiene que definir Mariluz: qué números quiere ver acá, con qué
 * periodicidad y comparados contra qué (¿el mes anterior?, ¿un objetivo
 * fijo?). Está anotado como pregunta pendiente desde el mapeo del 21/09 en
 * `docs/arquitectura.md` — no se inventa ninguna métrica mientras esa
 * respuesta no llegue.
 */
export default async function PanelEjecutivoPage({
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
          <h1 className="text-xl font-semibold">Panel ejecutivo</h1>
        </div>
        <Link href={`/recetas?sede=${sedeActiva.id}`} className="text-sm text-slate-500 hover:underline">
          Volver
        </Link>
      </div>

      <div className="card max-w-xl p-5">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Esta pantalla todavía está pendiente. Antes de construirla necesitamos que Mariluz
          defina qué indicadores debe mostrar el panel ejecutivo (por ejemplo: food cost
          promedio, recetas fuera de margen, evolución de costos por familia) y con qué se
          comparan. En cuanto esté esa definición, se arma esta pantalla con los mismos datos
          y fórmulas que ya se usan en el resto de Gastro Central — nada se calcula distinto
          ni se inventa acá.
        </p>
      </div>
    </div>
  );
}
