import Link from "next/link";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import { listarRecetas } from "@/lib/data/recetas";
import { calcularResumenCosteo } from "@/lib/costeo";

const COLOR_SEMAFORO: Record<string, string> = {
  verde: "bg-semaforo-verde",
  amarillo: "bg-semaforo-amarillo",
  rojo: "bg-semaforo-rojo",
};

export default async function RecetasPage({
  searchParams,
}: {
  searchParams: { sede?: string };
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  const sedesVisibles = await getSedesVisibles();
  const sedeActiva = resolverSedeActiva(usuario, sedesVisibles, searchParams.sede);
  if (!sedeActiva) return <p style={{ color: "var(--muted)" }}>No hay ninguna sede disponible.</p>;

  const recetas = await listarRecetas(sedeActiva.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">{sedeActiva.marca_nombre} / {sedeActiva.nombre}</p>
          <h1 className="text-xl font-semibold">Recetas</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{recetas.length} recetas</p>
        </div>
        <Link href={`/recetas/nueva?sede=${sedeActiva.id}`} className="btn-primary">
          + Nueva receta
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="erp-scroll">
          <table className="erp-table recetas-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Familia</th>
                <th className="text-right">Costo porción</th>
                <th className="text-right">Precio real</th>
                <th className="text-right">Food cost</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recetas.map((r) => {
                const resumen = r.precio_real
                  ? calcularResumenCosteo(r.costo_porcion, r.precio_real)
                  : null;
                return (
                  <tr key={r.id}>
                    <td className="font-medium">{r.nombre}</td>
                    <td style={{ color: "var(--muted)" }}>{r.familia_nombre ?? "—"}</td>
                    <td className="text-right fin-value">{r.costo_porcion.toFixed(2)}</td>
                    <td className="text-right fin-value">
                      {r.precio_real?.toFixed(2) ?? "—"}
                    </td>
                    <td className="text-right">
                      {resumen ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${COLOR_SEMAFORO[resumen.semaforo]}`}
                          />
                          {(resumen.foodCost * 100).toFixed(1)}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-right">
                      <Link href={`/recetas/${r.id}?sede=${sedeActiva.id}`} className="text-sm font-medium text-[#2563EB] hover:underline">
                        Editar
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {recetas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    Todavía no hay recetas.
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
