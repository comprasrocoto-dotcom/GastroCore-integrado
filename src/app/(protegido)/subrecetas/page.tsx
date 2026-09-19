import Link from "next/link";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import { listarSubrecetas } from "@/lib/data/subrecetas";

export default async function SubrecetasPage({
  searchParams,
}: {
  searchParams: { sede?: string };
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  const sedesVisibles = await getSedesVisibles();
  const sedeActiva = resolverSedeActiva(usuario, sedesVisibles, searchParams.sede);
  if (!sedeActiva) return <p style={{ color: "var(--muted)" }}>No hay ninguna sede disponible.</p>;

  const subrecetas = await listarSubrecetas(sedeActiva.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">{sedeActiva.marca_nombre} / {sedeActiva.nombre}</p>
          <h1 className="text-xl font-semibold">Subrecetas</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{subrecetas.length} subrecetas</p>
        </div>
        <Link href={`/subrecetas/nueva?sede=${sedeActiva.id}`} className="btn-primary">
          + Nueva subreceta
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="erp-scroll">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Rendimiento</th>
                <th className="text-right">Costo total</th>
                <th className="text-right">Costo unitario</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {subrecetas.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.nombre}</td>
                  <td style={{ color: "var(--muted)" }}>
                    {s.rendimiento ?? "—"} {s.unidad_rendimiento_codigo ?? ""}
                  </td>
                  <td className="text-right fin-value">{s.costo_total.toFixed(2)}</td>
                  <td className="text-right fin-value">{s.costo_unitario.toFixed(4)}</td>
                  <td className="text-right">
                    <Link href={`/subrecetas/${s.id}?sede=${sedeActiva.id}`} className="text-sm font-medium text-[#2563EB] hover:underline">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
              {subrecetas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Todavía no hay subrecetas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
