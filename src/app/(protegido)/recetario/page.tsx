import Link from "next/link";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import { listarRecetario } from "@/lib/data/recetario";

export default async function RecetarioPage({
  searchParams,
}: {
  searchParams: { sede?: string };
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  const sedesVisibles = await getSedesVisibles();
  const sedeActiva = resolverSedeActiva(usuario, sedesVisibles, searchParams.sede);
  if (!sedeActiva) return <p style={{ color: "var(--muted)" }}>No hay ninguna sede disponible.</p>;

  const recetas = await listarRecetario(sedeActiva.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow">{sedeActiva.marca_nombre} / {sedeActiva.nombre}</p>
        <h1 className="text-xl font-semibold">Recetario</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Solo preparación y emplatado — sin costos ni precios.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recetas.map((r) => (
          <Link
            key={r.receta_id}
            href={`/recetario/${r.receta_id}?sede=${sedeActiva.id}`}
            className="card card-hover flex flex-col gap-1 p-5"
          >
            <p className="font-semibold">{r.receta_nombre}</p>
            <p className="text-sm" style={{ color: "var(--muted)" }}>{r.familia_nombre ?? "Sin familia"}</p>
            {r.rendimiento && (
              <p className="mt-1 text-xs text-slate-400">
                Rinde {r.rendimiento} {r.unidad_rendimiento_codigo ?? ""}
              </p>
            )}
          </Link>
        ))}
        {recetas.length === 0 && (
          <p className="text-slate-400">Todavía no hay recetas activas.</p>
        )}
      </div>
    </div>
  );
}
