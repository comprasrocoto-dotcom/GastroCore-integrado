import Link from "next/link";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import { listarSubrecetas } from "@/lib/data/subrecetas";

/**
 * Listado de subrecetas — misma estructura que el GastroCore real:
 * tarjetas de estadísticas arriba, buscador + "ver inactivas", y una
 * tabla con la referencia del insumo maestro y el chequeo de deriva
 * entre el costo del insumo "SUB." y el costo recién calculado de la
 * subreceta (ver lib/data/subrecetas.ts).
 */
export default async function SubrecetasPage({
  searchParams,
}: {
  searchParams: { sede?: string; q?: string; inactivas?: string };
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  const sedesVisibles = await getSedesVisibles();
  const sedeActiva = resolverSedeActiva(usuario, sedesVisibles, searchParams.sede);
  if (!sedeActiva) return <p style={{ color: "var(--muted)" }}>No hay ninguna sede disponible.</p>;

  const todas = await listarSubrecetas(sedeActiva.id);
  const verInactivas = searchParams.inactivas === "1";
  const q = (searchParams.q ?? "").trim().toLowerCase();

  const subrecetas = todas
    .filter((s) => (verInactivas ? true : s.activo))
    .filter((s) => (q ? s.nombre.toLowerCase().includes(q) : true));

  const totalSubrecetas = todas.length;
  const costoPromedio =
    todas.length === 0 ? 0 : todas.reduce((acc, s) => acc + s.costo_unitario, 0) / todas.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">{sedeActiva.marca_nombre} / {sedeActiva.nombre}</p>
          <h1 className="text-xl font-semibold">Subrecetas · Preparaciones base</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Preparaciones que se costean como una receta y se usan como insumo en otras recetas.
          </p>
        </div>
        <Link href={`/subrecetas/nueva?sede=${sedeActiva.id}`} className="btn-primary">
          + Nueva subreceta
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Total subrecetas
          </p>
          <p className="mt-2 text-3xl font-bold">{totalSubrecetas}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Costo prom. por unidad
          </p>
          <p className="mt-2 text-3xl font-bold">${costoPromedio.toFixed(0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Mostrando
          </p>
          <p className="mt-2 text-3xl font-bold">{subrecetas.length}</p>
        </div>
      </div>

      <form className="flex flex-wrap items-center gap-3" method="get">
        <input type="hidden" name="sede" value={sedeActiva.id} />
        <input
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Buscar subreceta..."
          className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[#1E3A5F]"
        />
        <label className="flex items-center gap-1.5 text-sm" style={{ color: "var(--muted)" }}>
          <input type="checkbox" name="inactivas" value="1" defaultChecked={verInactivas} />
          Ver inactivas
        </label>
        <button type="submit" className="btn-secondary">Filtrar</button>
      </form>

      <div className="card overflow-hidden">
        <div className="erp-scroll">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Referencia</th>
                <th>Rendimiento</th>
                <th className="text-right">Costo total</th>
                <th>Estado</th>
                <th>Insumos vs subreceta</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {subrecetas.map((s) => {
                const hayDeriva =
                  s.insumo_coste !== null && Math.abs(s.insumo_coste - s.costo_unitario) >= 0.5;
                return (
                  <tr key={s.id}>
                    <td className="font-medium">{s.nombre}</td>
                    <td style={{ color: "var(--muted)" }}>{s.insumo_referencia ?? "—"}</td>
                    <td style={{ color: "var(--muted)" }}>
                      {s.rendimiento ?? "—"} {s.unidad_rendimiento_codigo ?? ""}
                    </td>
                    <td className="text-right fin-value">{s.costo_total.toFixed(2)}</td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.activo ? "bg-semaforo-verde/15 text-emerald-700" : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {s.activo ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="text-xs">
                      <div style={{ color: "var(--muted)" }}>
                        Insumos: ${s.insumo_coste !== null ? s.insumo_coste.toFixed(0) : "—"}
                      </div>
                      <div className={hayDeriva ? "font-medium text-amber-600" : ""} style={hayDeriva ? undefined : { color: "var(--muted)" }}>
                        Subreceta: ${s.costo_unitario.toFixed(0)} {hayDeriva ? "≠" : ""}
                      </div>
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/subrecetas/${s.id}?sede=${sedeActiva.id}`}
                        className="text-sm font-medium text-[#2563EB] hover:underline"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {subrecetas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
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
