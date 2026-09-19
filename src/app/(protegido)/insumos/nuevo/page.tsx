import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { listarSubfamilias, listarUnidades } from "@/lib/data/insumos";
import InsumoForm from "../InsumoForm";
import { crearInsumo } from "../actions";

export default async function NuevoInsumoPage({
  searchParams,
}: {
  searchParams: { sede?: string };
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  const sedesVisibles = await getSedesVisibles();
  const sedeActiva = resolverSedeActiva(usuario, sedesVisibles, searchParams.sede);

  if (!sedeActiva) {
    return <p style={{ color: "var(--muted)" }}>No hay ninguna sede disponible.</p>;
  }

  const [subfamilias, unidades] = await Promise.all([
    listarSubfamilias(sedeActiva.id),
    listarUnidades(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="eyebrow">{sedeActiva.marca_nombre} / {sedeActiva.nombre}</p>
        <h1 className="text-xl font-semibold">Nuevo insumo</h1>
      </div>
      <InsumoForm
        accion={crearInsumo}
        subfamilias={subfamilias.map((s) => ({
          id: s.id,
          etiqueta: `${s.familia_nombre} / ${s.nombre}`,
        }))}
        unidades={unidades.map((u) => ({ id: u.codigo, etiqueta: `${u.codigo} — ${u.nombre}` }))}
        sedeId={sedeActiva.id}
        esEdicion={false}
      />
    </div>
  );
}
