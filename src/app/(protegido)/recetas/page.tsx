import Link from "next/link";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import { listarRecetas } from "@/lib/data/recetas";
import { listarFamiliasConSubfamilias } from "@/lib/data/familias";
import { calcularResumenCosteo, type OpcionesCosteo } from "@/lib/costeo";
import { obtenerConfiguracionCosteo } from "@/lib/data/configuracion";

const COLOR_SEMAFORO: Record<string, string> = {
  verde: "bg-semaforo-verde",
  amarillo: "bg-semaforo-amarillo",
  rojo: "bg-semaforo-rojo",
};

/**
 * Recetario — misma estructura que el GastroCore real: tarjetas de
 * estadísticas arriba, panel lateral de familias a la izquierda, filtros,
 * y la tabla de recetas agrupada por familia con el semáforo de food
 * cost. El panel lateral hoy agrupa solo por familia (un nivel); el
 * segundo nivel (subfamilia, ej. "Bar → Sodas") se suma cuando se apruebe
 * agregar `subfamilia_id` a `recetas` — ver mensaje a Mariluz del 19/09.
 */
export default async function RecetasPage({
  searchParams,
}: {
  searchParams: { sede?: string; familia?: string; q?: string };
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  const sedesVisibles = await getSedesVisibles();
  const sedeActiva = resolverSedeActiva(usuario, sedesVisibles, searchParams.sede);
  if (!sedeActiva) return <p style={{ color: "var(--muted)" }}>No hay ninguna sede disponible.</p>;

  const [todas, familias, config] = await Promise.all([
    listarRecetas(sedeActiva.id),
    listarFamiliasConSubfamilias(sedeActiva.id),
    obtenerConfiguracionCosteo(sedeActiva.id),
  ]);

  const q = (searchParams.q ?? "").trim().toLowerCase();
  const familiaFiltro = searchParams.familia ?? "";

  const filtradas = todas
    .filter((r) => (familiaFiltro ? r.familia_id === familiaFiltro : true))
    .filter((r) => (q ? r.nombre.toLowerCase().includes(q) : true));

  const conResumen = todas
    .filter((r) => r.precio_real)
    .map((r) =>
      calcularResumenCosteo(r.costo_porcion, r.precio_real as number, {
        fcObjetivo: config.fcObjetivo,
        iva: r.iva,
      })
    );

  const hoyIso = new Date().toISOString().slice(0, 10);

  const totalRecetas = todas.length;
  const costoPromedio =
    todas.length === 0 ? 0 : todas.reduce((acc, r) => acc + r.costo_porcion, 0) / todas.length;
  const foodCostProm =
    conResumen.length === 0 ? 0 : conResumen.reduce((acc, r) => acc + r.foodCost, 0) / conResumen.length;
  const rentables = conResumen.filter((r) => r.semaforo !== "rojo").length;
  const fueraDeObjetivo = conResumen.filter((r) => r.semaforo === "rojo").length;
  const sinPrecio = todas.filter((r) => !r.precio_real).length;
  const actualizadasHoy = todas.filter((r) => r.actualizado_en?.slice(0, 10) === hoyIso).length;

  const conSede = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    sp.set("sede", sedeActiva.id);
    if (params.familia) sp.set("familia", params.familia);
    if (params.q) sp.set("q", params.q);
    return `/recetas?${sp.toString()}`;
  };

  // Agrupa las recetas filtradas por familia para la tabla, en el mismo
  // orden que el panel lateral.
  const gruposPorFamilia = new Map<string, { nombre: string; recetas: typeof filtradas }>();
  const sinFamilia: typeof filtradas = [];
  for (const r of filtradas) {
    if (!r.familia_id) {
      sinFamilia.push(r);
      continue;
    }
    if (!gruposPorFamilia.has(r.familia_id)) {
      gruposPorFamilia.set(r.familia_id, { nombre: r.familia_nombre ?? "Sin nombre", recetas: [] });
    }
    gruposPorFamilia.get(r.familia_id)!.recetas.push(r);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">{sedeActiva.marca_nombre} / {sedeActiva.nombre}</p>
          <h1 className="text-xl font-semibold">Recetario</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Consultá y administrá tus recetas por familia, con costeo en tiempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/recetario?sede=${sedeActiva.id}`} className="btn-secondary">
            Solo preparación
          </Link>
          <Link href={`/familias?sede=${sedeActiva.id}`} className="btn-secondary">
            Familias
          </Link>
          <Link href={`/recetas/nueva?sede=${sedeActiva.id}`} className="btn-primary">
            + Nueva receta
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Total recetas
          </p>
          <p className="mt-2 text-3xl font-bold">{totalRecetas}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Costo promedio
          </p>
          <p className="mt-2 text-3xl font-bold">${costoPromedio.toFixed(0)}</p>
        </div>
        <div className="card p-4" style={{ background: "rgba(34,197,94,0.08)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Food cost prom.
          </p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{(foodCostProm * 100).toFixed(1)}%</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:col-span-2 lg:col-span-1">
          <div className="card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Rentables</p>
            <p className="mt-1 text-xl font-bold text-emerald-600">{rentables}</p>
          </div>
          <div className="card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Fuera de objetivo</p>
            <p className="mt-1 text-xl font-bold text-red-600">{fueraDeObjetivo}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Sin precio</p>
          <p className="mt-1 text-xl font-bold text-amber-600">{sinPrecio}</p>
        </div>
        <div className="card p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>Actualizadas hoy</p>
          <p className="mt-1 text-xl font-bold">{actualizadasHoy}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="card flex flex-col gap-1 p-3">
          <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Familias
          </p>
          <Link
            href={conSede({ q: searchParams.q })}
            className={`rounded-lg px-2 py-1.5 text-sm font-medium ${
              !familiaFiltro ? "bg-[#EFF6FF] text-[#1E3A5F]" : "hover:bg-slate-50"
            }`}
          >
            Todas las recetas
          </Link>
          {familias.map((f) => {
            const cantidad = todas.filter((r) => r.familia_id === f.id).length;
            return (
              <div key={f.id}>
                <Link
                  href={conSede({ familia: f.id, q: searchParams.q })}
                  className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm font-medium ${
                    familiaFiltro === f.id ? "bg-[#EFF6FF] text-[#1E3A5F]" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">{f.nombre}</span>
                  <span className="text-xs text-slate-400">{cantidad}</span>
                </Link>
                {f.subfamilias.length > 0 && (
                  <div className="ml-3 flex flex-col">
                    {f.subfamilias.map((s) => (
                      <span key={s.id} className="truncate px-2 py-1 text-xs" style={{ color: "var(--muted)" }}>
                        {s.nombre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {familias.length === 0 && (
            <p className="px-2 py-1 text-xs text-slate-400">
              Todavía no hay familias creadas.
            </p>
          )}
        </aside>

        <div className="flex flex-col gap-4">
          <form className="flex flex-wrap items-center gap-3" method="get">
            <input type="hidden" name="sede" value={sedeActiva.id} />
            {familiaFiltro && <input type="hidden" name="familia" value={familiaFiltro} />}
            <input
              name="q"
              defaultValue={searchParams.q ?? ""}
              placeholder="Buscar receta..."
              className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[#1E3A5F]"
            />
            <button type="submit" className="btn-secondary">Filtrar</button>
          </form>

          {[...gruposPorFamilia.entries()].map(([familiaId, grupo]) => (
            <div key={familiaId} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: "var(--line)" }}>
                <p className="text-sm font-semibold">{grupo.nombre}</p>
                <span className="text-xs text-slate-400">{grupo.recetas.length} recetas</span>
              </div>
              <TablaRecetas sedeId={sedeActiva.id} recetas={grupo.recetas} config={config} />
            </div>
          ))}

          {sinFamilia.length > 0 && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: "var(--line)" }}>
                <p className="text-sm font-semibold">Sin familia</p>
                <span className="text-xs text-slate-400">{sinFamilia.length} recetas</span>
              </div>
              <TablaRecetas sedeId={sedeActiva.id} recetas={sinFamilia} config={config} />
            </div>
          )}

          {filtradas.length === 0 && (
            <p className="px-2 py-6 text-center text-slate-400">No hay recetas que coincidan con el filtro.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function TablaRecetas({
  sedeId,
  recetas,
  config,
}: {
  sedeId: string;
  recetas: Awaited<ReturnType<typeof listarRecetas>>;
  config: OpcionesCosteo;
}) {
  return (
    <div className="erp-scroll">
      <table className="erp-table recetas-table">
        <thead>
          <tr>
            <th>Receta</th>
            <th className="text-right">Costo porción</th>
            <th className="text-right">Precio venta</th>
            <th className="text-right">Precio sugerido</th>
            <th className="text-right">Food cost</th>
          </tr>
        </thead>
        <tbody>
          {recetas.map((r) => {
            const resumen = r.precio_real
              ? calcularResumenCosteo(r.costo_porcion, r.precio_real, {
                  fcObjetivo: config.fcObjetivo,
                  iva: r.iva,
                })
              : null;
            return (
              <tr key={r.id}>
                <td className="font-medium">
                  <Link href={`/recetas/${r.id}?sede=${sedeId}`} className="text-[#2563EB] hover:underline">
                    {r.nombre}
                  </Link>
                </td>
                <td className="text-right fin-value">{r.costo_porcion.toFixed(0)}</td>
                <td className="text-right fin-value">{r.precio_real?.toFixed(0) ?? "—"}</td>
                <td className="text-right fin-value">
                  {resumen ? resumen.precioSugerido.toFixed(0) : "—"}
                </td>
                <td className="text-right">
                  {resumen ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${COLOR_SEMAFORO[resumen.semaforo]}`} />
                      {(resumen.foodCost * 100).toFixed(1)}% · {resumen.semaforo === "rojo" ? "Fuera de objetivo" : "Rentable"}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
