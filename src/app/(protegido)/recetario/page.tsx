import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import { listarRecetario } from "@/lib/data/recetario";
import RecetarioExplorador from "./RecetarioExplorador";

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

  const items = await listarRecetario(sedeActiva.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow">{sedeActiva.marca_nombre} / {sedeActiva.nombre}</p>
        <h1 className="text-xl font-semibold">Recetario</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Solo preparación y emplatado — sin costos ni precios.
        </p>
      </div>

      <RecetarioExplorador items={items} />
    </div>
  );
}
