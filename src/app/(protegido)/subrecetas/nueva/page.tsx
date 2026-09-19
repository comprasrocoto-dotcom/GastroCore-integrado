import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import SubrecetaForm from "../SubrecetaForm";

export default async function NuevaSubrecetaPage({
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
    <div className="flex max-w-md flex-col gap-4">
      <div>
        <p className="eyebrow">{sedeActiva.marca_nombre} / {sedeActiva.nombre}</p>
        <h1 className="text-xl font-semibold">Nueva subreceta</h1>
      </div>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Se va a crear también un insumo &quot;SUB.…&quot; que la representa,
        para poder usarla dentro de otras recetas.
      </p>
      <SubrecetaForm sedeId={sedeActiva.id} />
    </div>
  );
}
