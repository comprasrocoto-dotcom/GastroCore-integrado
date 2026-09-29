import Link from "next/link";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import { listarRecetas } from "@/lib/data/recetas";
import { listarFamiliasConSubfamilias } from "@/lib/data/familias";
import {
  calcularResumenCosteo,
  semaforoFoodCost,
  SEMAFORO_VERDE_MAX,
  SEMAFORO_AMARILLO_MAX,
  type OpcionesCosteo,
  type Semaforo,
} from "@/lib/costeo";
import { obtenerConfiguracionCosteo } from "@/lib/data/configuracion";

const COLOR_SEMAFORO: Record<Semaforo, string> = {
  verde: "bg-semaforo-verde",
  amarillo: "bg-semaforo-amarillo",
  rojo: "bg-semaforo-rojo",
};

const TEXTO_SEMAFORO: Record<Semaforo, string> = {
  verde: "text-emerald-600",
  amarillo: "text-amber-700",
  rojo: "text-red-600",
};

/** Igual redacción que usa GastroCore real ("Accion inmediata", sin tilde). */
const ETIQUETA_SEMAFORO: Record<Semaforo, string> = {
  verde: "Rentable",
  amarillo: "Vigilar",
  rojo: "Accion inmediata",
};

/**
 * Recetario — misma estructura que el GastroCore real
 * (gastro-core.vercel.app/recetas, verificado el 29/09 con datos en vivo):
 * tarjetas de estadísticas arriba, panel lateral de Centro de costo →
 * Familia a la izquierda, filtros (familia, food cost, estado, centro de
 * costo) y la tabla de recetas agrupada en esos mismos dos niveles con el
 * semáforo de food cost. "Centro de costo" (BAR/COCINA) es un campo sobre
 * cada familia (`familias.centrocosto`), no una tabla aparte — las
 * `subfamilias` son para otra clasificación (insumos), no para esta
 * pantalla.
 */
export default async function RecetasPage({
  searchParams,
}: {
  searchParams: {
    sede?: string;
    familia?: string;
    centrocosto?: string;
    foodcost?: string;
    estado?: string;
    q?: string;
  };
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

  const centrocostoPorFamilia = new Map<string, string | null>();
  familias.forEach((f) => centrocostoPorFamilia.set(f.id, f.centrocosto));
  const centrocostoDe = (r: { familia_id: string | null }) =>
    r.familia_id ? centrocostoPorFamilia.get(r.familia_id) ?? null : null;

  const q = (searchParams.q ?? "").trim().toLowerCase();
  const familiaFiltro = searchParams.familia ?? "";
  const centrocostoFiltro = searchParams.centrocosto ?? "";
  const foodcostFiltro = searchParams.foodcost ?? ""; // "verde" | "amarillo" | "rojo"
  const estadoFiltro = searchParams.estado ?? "activos"; // "activos" | "inactivos" | "todos"

  const filtradas = todas
    .filter((r) => (familiaFiltro ? r.familia_id === familiaFiltro : true))
    .filter((r) => (centrocostoFiltro ? centrocostoDe(r) === centrocostoFiltro : true))
    .filter((r) => {
      if (!foodcostFiltro) return true;
      if (!r.precio_real) return false;
      const fc = calcularResumenCosteo(r.costo_porcion, r.precio_real, {
        fcObjetivo: config.fcObjetivo,
        iva: r.iva,
      }).semaforo;
      return fc === foodcostFiltro;
    })
    .filter((r) => {
      if (estadoFiltro === "todos") return true;
      if (estadoFiltro === "inactivos") return !r.activo;
      return r.activo;
    })
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
  const semaforoProm = semaforoFoodCost(foodCostProm);
  const rentables = conResumen.filter((r) => r.semaforo !== "rojo").length;
  const fueraDeObjetivo = conResumen.filter((r) => r.semaforo === "rojo").length;
  const sinPrecio = todas.filter((r) => !r.precio_real).length;
  const actualizadasHoy = todas.filter((r) => r.actualizado_en?.slice(0, 10) === hoyIso).length;

  const conSede = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    sp.set("sede", sedeActiva.id);
    if (params.familia) sp.set("familia", params.familia);
    if (params.centrocosto) sp.set("centrocosto", params.centrocosto);
    if (params.foodcost) sp.set("foodcost", params.foodcost);
    if (params.estado && params.estado !== "activos") sp.set("estado", params.estado);
    if (params.q) sp.set("q", params.q);
    return `/recetas?${sp.toString()}`;
  };

  // Panel lateral: Centro de costo (BAR/COCINA, campo de la familia) →
  // Familia, con la cantidad de recetas de cada una.
  const gruposCentroCosto = new Map<string, typeof familias>();
  const familiasSinCentro: typeof familias = [];
  for (const f of familias) {
    if (!f.centrocosto) {
      familiasSinCentro.push(f);
      continue;
    }
    if (!gruposCentroCosto.has(f.centrocosto)) gruposCentroCosto.set(f.centrocosto, []);
    gruposCentroCosto.get(f.centrocosto)!.push(f);
  }

  // Tabla: agrupa las recetas filtradas en los mismos dos niveles.
  const gruposPorCC = new Map<string, { nombre: string; recetas: typeof filtradas }>();
  const sinCC: typeof filtradas = [];
  for (const r of filtradas) {
    const cc = centrocostoDe(r);
    if (!cc) {
      sinCC.push(r);
      continue;
    }
    if (!gruposPorCC.has(cc)) gruposPorCC.set(cc, { nombre: cc, recetas: [] });
    gruposPorCC.get(cc)!.recetas.push(r);
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
          <Link href={`/familias?sede=${sedeActiva.id}`} className="btn-secondary">
            Familias
          </Link>
          <Link href={`/recetario?sede=${sedeActiva.id}`} className="btn-secondary">
            📖 Ver recetario completo
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
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Food cost prom.
            </p>
            <span className={`text-[11px] font-semibold ${TEXTO_SEMAFORO[semaforoProm]}`}>
              {ETIQUETA_SEMAFORO[semaforoProm]}
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{(foodCostProm * 100).toFixed(1)}%</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-1.5 rounded-full ${COLOR_SEMAFORO[semaforoProm]}`}
              style={{ width: `${Math.min((foodCostProm / 0.5) * 100, 100)}%` }}
            />
          </div>
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
              !familiaFiltro && !centrocostoFiltro ? "bg-[#EFF6FF] text-[#1E3A5F]" : "hover:bg-slate-50"
            }`}
          >
            Todas las recetas
          </Link>
          {[...gruposCentroCosto.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([cc, familiasCC]) => {
              const cantidadCC = todas.filter((r) => centrocostoDe(r) === cc).length;
              return (
                <div key={cc}>
                  <Link
                    href={conSede({ centrocosto: cc, q: searchParams.q })}
                    className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm font-bold ${
                      centrocostoFiltro === cc && !familiaFiltro ? "bg-[#EFF6FF] text-[#1E3A5F]" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate">🏷 {cc}</span>
                    <span className="text-xs font-normal text-slate-400">{cantidadCC}</span>
                  </Link>
                  <div className="ml-3 flex flex-col">
                    {familiasCC.map((f) => {
                      const cantidad = todas.filter((r) => r.familia_id === f.id).length;
                      return (
                        <Link
                          key={f.id}
                          href={conSede({ familia: f.id, q: searchParams.q })}
                          className={`flex items-center justify-between truncate rounded-lg px-2 py-1 text-sm ${
                            familiaFiltro === f.id ? "bg-[#EFF6FF] font-medium text-[#1E3A5F]" : "hover:bg-slate-50"
                          }`}
                        >
                          <span className="truncate">{f.nombre}</span>
                          <span className="text-xs text-slate-400">{cantidad}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          {familiasSinCentro.length > 0 && (
            <div>
              <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Sin centro de costo
              </p>
              {familiasSinCentro.map((f) => {
                const cantidad = todas.filter((r) => r.familia_id === f.id).length;
                return (
                  <Link
                    key={f.id}
                    href={conSede({ familia: f.id, q: searchParams.q })}
                    className={`flex items-center justify-between truncate rounded-lg px-2 py-1.5 text-sm font-medium ${
                      familiaFiltro === f.id ? "bg-[#EFF6FF] text-[#1E3A5F]" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate">{f.nombre}</span>
                    <span className="text-xs text-slate-400">{cantidad}</span>
                  </Link>
                );
              })}
            </div>
          )}
          {familias.length === 0 && (
            <p className="px-2 py-1 text-xs text-slate-400">
              Todavía no hay familias creadas.
            </p>
          )}
        </aside>

        <div className="flex flex-col gap-4">
          <form className="flex flex-wrap items-center gap-3" method="get">
            <input type="hidden" name="sede" value={sedeActiva.id} />
            {centrocostoFiltro && <input type="hidden" name="centrocosto" value={centrocostoFiltro} />}
            <input
              name="q"
              defaultValue={searchParams.q ?? ""}
              placeholder="Buscar receta..."
              className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[#1E3A5F]"
            />
            <select
              name="familia"
              defaultValue={familiaFiltro}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[#1E3A5F]"
            >
              <option value="">Todas las familias</option>
              {familias.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
            <select
              name="foodcost"
              defaultValue={foodcostFiltro}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[#1E3A5F]"
            >
              <option value="">Food Cost: todos</option>
              <option value="verde">Verde (≤{(SEMAFORO_VERDE_MAX * 100).toFixed(0)}%)</option>
              <option value="amarillo">
                Amarillo ({(SEMAFORO_VERDE_MAX * 100).toFixed(0)}-{(SEMAFORO_AMARILLO_MAX * 100).toFixed(0)}%)
              </option>
              <option value="rojo">Rojo (&gt;{(SEMAFORO_AMARILLO_MAX * 100).toFixed(0)}%)</option>
            </select>
            <select
              name="estado"
              defaultValue={estadoFiltro}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[#1E3A5F]"
            >
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
              <option value="todos">Todos</option>
            </select>
            <select
              name="centrocosto"
              defaultValue={centrocostoFiltro}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[#1E3A5F]"
            >
              <option value="">🏷 Centro de costo (todos)</option>
              {[...gruposCentroCosto.keys()].sort((a, b) => a.localeCompare(b)).map((cc) => (
                <option key={cc} value={cc}>
                  {cc}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-secondary">Filtrar</button>
          </form>

          {[...gruposPorCC.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([cc, grupo]) => {
              const porFamilia = new Map<string, { nombre: string; recetas: typeof filtradas }>();
              for (const r of grupo.recetas) {
                const fid = r.familia_id ?? "sin-familia";
                if (!porFamilia.has(fid)) {
                  porFamilia.set(fid, { nombre: r.familia_nombre ?? "Sin familia", recetas: [] });
                }
                porFamilia.get(fid)!.recetas.push(r);
              }
              return (
                <div key={cc} className="card overflow-hidden">
                  <div className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: "var(--line)" }}>
                    <p className="text-sm font-bold">🏷 {cc}</p>
                    <span className="text-xs text-slate-400">{grupo.recetas.length} recetas</span>
                  </div>
                  <div className="divide-y" style={{ borderColor: "var(--line)" }}>
                    {[...porFamilia.entries()].map(([fid, fam]) => (
                      <div key={fid}>
                        <p className="flex items-center justify-between bg-slate-50 px-4 py-1.5 text-xs font-semibold text-slate-500">
                          <span>{fam.nombre}</span>
                          <span className="text-slate-400">{fam.recetas.length}</span>
                        </p>
                        <TablaRecetas sedeId={sedeActiva.id} recetas={fam.recetas} config={config} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

          {sinCC.length > 0 && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: "var(--line)" }}>
                <p className="text-sm font-bold">Sin centro de costo</p>
                <span className="text-xs text-slate-400">{sinCC.length} recetas</span>
              </div>
              <TablaRecetas sedeId={sedeActiva.id} recetas={sinCC} config={config} />
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
  const money = (n: number) => "$" + (n || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });
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
                <td className="text-right fin-value">{money(r.costo_porcion)}</td>
                <td className="text-right fin-value">{r.precio_real ? money(r.precio_real) : "—"}</td>
                <td className="text-right fin-value">
                  {resumen ? (
                    resumen.semaforo === "amarillo" ? (
                      <span className="font-medium text-emerald-600">✓ Correcto</span>
                    ) : (
                      money(resumen.precioSugerido)
                    )
                  ) : (
                    "—"
                  )}
                </td>
                <td className="text-right">
                  {resumen ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${COLOR_SEMAFORO[resumen.semaforo]}`} />
                      <span className={`font-semibold ${TEXTO_SEMAFORO[resumen.semaforo]}`}>
                        {(resumen.foodCost * 100).toFixed(1)}% · {ETIQUETA_SEMAFORO[resumen.semaforo]}
                      </span>
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
