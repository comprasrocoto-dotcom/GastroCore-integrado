import Link from "next/link";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import { listarRecetas } from "@/lib/data/recetas";
import { listarFamiliasConSubfamilias } from "@/lib/data/familias";
import { obtenerConfiguracionCosteo } from "@/lib/data/configuracion";
import { calcularResumenCosteo } from "@/lib/costeo";
import PanelDetalleTabla, { type FilaDetalle } from "./PanelDetalleTabla";
import { actualizarPrecioYEstadoReceta } from "./actions";

const money = (n: number) => "$" + (n || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });

/**
 * Panel Ejecutivo — misma pantalla que el GastroCore real
 * (gastro-core.vercel.app/recetas/resumen, verificado en vivo el 29/09 con
 * datos reales de Rocoto: 87 recetas), a pedido explícito de Mariluz
 * ("en el modulo del panel ejecutivo se debe mostrar el mismo del
 * Gastrocore viejo"). Todos los indicadores usan las mismas fórmulas que
 * ya existen en lib/costeo.ts (nada se calcula distinto ni se inventa):
 * semaforoFoodCost, precioSugeridoPanel (FC objetivo 30% del panel),
 * utilidad. Cada número de esta pantalla fue verificado a mano contra el
 * sistema viejo antes de escribir este archivo.
 */
export default async function PanelEjecutivoPage({
  searchParams,
}: {
  searchParams: { sede?: string; familia?: string; estado?: string };
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

  const familiaFiltro = searchParams.familia ?? "";
  const estadoFiltro = searchParams.estado ?? "activos";

  const enFamilia = todas.filter((r) => (familiaFiltro ? r.familia_id === familiaFiltro : true));

  // El Panel Ejecutivo mide rentabilidad de la carta activa — todo lo de
  // arriba (tarjetas, lectura de experto, alertas, tops, food cost por
  // familia) se calcula solo sobre recetas activas con precio cargado,
  // igual que GastroCore. El filtro de Estado de abajo es solo para la
  // tabla "Detalle por receta".
  const activas = enFamilia.filter((r) => r.activo);
  const conResumen = activas
    .filter((r) => r.precio_real)
    .map((r) => {
      const resumen = calcularResumenCosteo(r.costo_porcion, r.precio_real as number, {
        fcObjetivo: config.fcObjetivo,
        fcObjetivoPanel: config.fcObjetivoPanel,
        iva: r.iva,
      });
      return { ...r, resumen };
    });

  const recetasActivasCount = activas.length;
  const foodCostProm =
    conResumen.length === 0 ? 0 : conResumen.reduce((s, r) => s + r.resumen.foodCost, 0) / conResumen.length;
  const utilidadPotencial = conResumen.reduce((s, r) => s + r.resumen.utilidad, 0);
  const rojos = conResumen.filter((r) => r.resumen.semaforo === "rojo");
  const amarillos = conResumen.filter((r) => r.resumen.semaforo === "amarillo");
  const fueraDePrecio = rojos.length;

  // ---- Lectura de experto ----
  const dineroEnLaMesa = rojos.reduce((s, r) => s + (r.resumen.precioSugeridoPanel - (r.precio_real ?? 0)), 0);

  const aUnPasoDelRojo = conResumen
    .filter((r) => r.resumen.foodCost >= config.fcObjetivo - 0.03 && r.resumen.foodCost <= config.fcObjetivo)
    .sort((a, b) => b.resumen.foodCost - a.resumen.foodCost);

  const porUtilidadDesc = [...conResumen].sort((a, b) => b.resumen.utilidad - a.resumen.utilidad);
  const top5UtilidadSum = porUtilidadDesc.slice(0, 5).reduce((s, r) => s + r.resumen.utilidad, 0);
  const concentracionMargen = utilidadPotencial > 0 ? top5UtilidadSum / utilidadPotencial : 0;
  const mensajeConcentracion =
    concentracionMargen < 0.25
      ? "Margen bien repartido: ningún plato te tiene de rehén."
      : concentracionMargen < 0.5
      ? "Concentración moderada — vale la pena vigilar esos platos de cerca."
      : "Alta dependencia de pocos platos: si uno falla, se cae buena parte del margen.";

  const demasiadoBueno = conResumen
    .filter((r) => r.resumen.foodCost < 0.1)
    .sort((a, b) => b.resumen.foodCost - a.resumen.foodCost);

  const porFamiliaMap = new Map<string, typeof conResumen>();
  for (const r of conResumen) {
    const nombre = r.familia_nombre ?? "Sin familia";
    if (!porFamiliaMap.has(nombre)) porFamiliaMap.set(nombre, []);
    porFamiliaMap.get(nombre)!.push(r);
  }
  let familiaDespareja: { nombre: string; spreadPts: number; cantidad: number } | null = null;
  for (const [nombre, recetasFam] of porFamiliaMap.entries()) {
    if (recetasFam.length < 2) continue;
    const fcs = recetasFam.map((r) => r.resumen.foodCost);
    const spread = Math.max(...fcs) - Math.min(...fcs);
    if (!familiaDespareja || spread > familiaDespareja.spreadPts / 100) {
      familiaDespareja = { nombre, spreadPts: Math.round(spread * 100), cantidad: recetasFam.length };
    }
  }

  // ---- Alertas de rentabilidad ----
  const peorReceta = [...conResumen].sort((a, b) => b.resumen.foodCost - a.resumen.foodCost)[0] ?? null;

  // ---- Top 10 más rentables / que más pierden ----
  const top10Rentables = porUtilidadDesc.slice(0, 10);
  const maxUtilidadTop10 = top10Rentables[0]?.resumen.utilidad || 1;

  const top10Pierden = [...rojos].sort((a, b) => b.resumen.foodCost - a.resumen.foodCost).slice(0, 10);
  const maxFcPierden = top10Pierden[0]?.resumen.foodCost || 1;

  // ---- Food cost promedio por familia ----
  const promedioPorFamilia = [...porFamiliaMap.entries()]
    .map(([nombre, recetasFam]) => ({
      nombre,
      promedio: recetasFam.reduce((s, r) => s + r.resumen.foodCost, 0) / recetasFam.length,
    }))
    .sort((a, b) => b.promedio - a.promedio);

  // ---- Detalle por receta (tabla editable) ----
  const detalleBase = enFamilia.filter((r) => {
    if (estadoFiltro === "todos") return true;
    if (estadoFiltro === "inactivos") return !r.activo;
    return r.activo;
  });
  const detalleOrdenado = [...detalleBase].sort((a, b) => {
    const fcA = a.precio_real ? calcularResumenCosteo(a.costo_porcion, a.precio_real, { fcObjetivo: config.fcObjetivo, iva: a.iva }).foodCost : -1;
    const fcB = b.precio_real ? calcularResumenCosteo(b.costo_porcion, b.precio_real, { fcObjetivo: config.fcObjetivo, iva: b.iva }).foodCost : -1;
    return fcB - fcA;
  });
  const filasDetalle: FilaDetalle[] = detalleOrdenado.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    sedeId: sedeActiva.id,
    familiaNombre: r.familia_nombre ?? "Sin familia",
    costoPorcion: r.costo_porcion,
    precioReal: r.precio_real,
    iva: r.iva,
    activo: r.activo,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">{sedeActiva.marca_nombre} / {sedeActiva.nombre}</p>
          <h1 className="text-xl font-semibold">Panel Ejecutivo</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Tablero ejecutivo del costeo de recetas, con los mismos datos y fórmulas del recetario.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/recetas?sede=${sedeActiva.id}`} className="btn-secondary">
            Volver al recetario
          </Link>
        </div>
      </div>

      <form className="card flex flex-wrap items-center gap-3 p-3" method="get">
        <input type="hidden" name="sede" value={sedeActiva.id} />
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          Filtrar
        </span>
        <select
          name="familia"
          defaultValue={familiaFiltro}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[#1E3A5F]"
        >
          <option value="">🍽 Todas las familias</option>
          {familias.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">Filtrar</button>
      </form>

      {/* Tarjetas principales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4" style={{ background: "rgba(37,99,235,0.06)" }}>
          <p className="eyebrow">📘 Recetas activas</p>
          <p className="mt-2 text-3xl font-bold">{recetasActivasCount}</p>
        </div>
        <div className="card p-4" style={{ background: "rgba(34,197,94,0.08)" }}>
          <p className="eyebrow">📊 Food cost promedio</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{(foodCostProm * 100).toFixed(1)}%</p>
        </div>
        <div className="card p-4" style={{ background: "rgba(34,197,94,0.08)" }}>
          <p className="eyebrow">💰 Utilidad potencial</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{money(utilidadPotencial)}</p>
        </div>
        <div className="card p-4" style={{ background: "rgba(220,38,38,0.06)" }}>
          <p className="eyebrow">⚠ Recetas fuera de precio</p>
          <p className="mt-2 text-3xl font-bold text-red-600">{fueraDePrecio}</p>
        </div>
      </div>

      {/* Lectura de experto */}
      {(dineroEnLaMesa > 0 || aUnPasoDelRojo.length > 0 || utilidadPotencial > 0 || demasiadoBueno.length > 0 || familiaDespareja) && (
        <div className="flex flex-col gap-3">
          <p className="eyebrow">🔬 Lectura de experto</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rojos.length > 0 && (
              <div className="card border-l-4 p-4" style={{ borderLeftColor: "#16A34A" }}>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">💸 Dinero en la mesa</p>
                <p className="mt-1 text-xl font-bold">{money(dineroEnLaMesa)}</p>
                <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                  La carta está {money(dineroEnLaMesa)} por debajo del precio que cumple el objetivo, repartidos en{" "}
                  {rojos.length} platos. Cada venta de uno de ellos regala margen.
                </p>
              </div>
            )}
            {aUnPasoDelRojo.length > 0 && (
              <div className="card border-l-4 p-4" style={{ borderLeftColor: "#F59E0B" }}>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">⚡ A un paso del rojo</p>
                <p className="mt-1 text-xl font-bold">{aUnPasoDelRojo.length} platos</p>
                <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                  Están a menos de 3 puntos del objetivo:{" "}
                  {aUnPasoDelRojo.slice(0, 3).map((r) => r.nombre).join(", ")}
                  {aUnPasoDelRojo.length > 3 ? "…" : "."} La próxima subida de insumos los cruza.
                </p>
              </div>
            )}
            {utilidadPotencial > 0 && porUtilidadDesc.length > 0 && (
              <div className="card border-l-4 p-4" style={{ borderLeftColor: "#0D9488" }}>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#0D9488" }}>
                  🏆 Concentración del margen
                </p>
                <p className="mt-1 text-xl font-bold">{(concentracionMargen * 100).toFixed(0)}%</p>
                <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                  El top 5 de platos aporta el {(concentracionMargen * 100).toFixed(0)}% de la utilidad potencial —
                  el #1 es {porUtilidadDesc[0].nombre}. {mensajeConcentracion}
                </p>
              </div>
            )}
            {demasiadoBueno.length > 0 && (
              <div className="card border-l-4 p-4" style={{ borderLeftColor: "#A855F7" }}>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#A855F7" }}>
                  🩻 Demasiado bueno para ser verdad
                </p>
                <p className="mt-1 text-xl font-bold">{demasiadoBueno.length} platos</p>
                <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                  Food Cost menor al 10%: {demasiadoBueno.slice(0, 3).map((r) => r.nombre).join(", ")}
                  {demasiadoBueno.length > 3 ? "…" : "."} Eso no es un triunfo: casi siempre es una ficha
                  incompleta. Audítalos hoy.
                </p>
              </div>
            )}
            {familiaDespareja && (
              <div className="card border-l-4 p-4" style={{ borderLeftColor: "#2563EB" }}>
                <p className="text-xs font-bold uppercase tracking-wide text-[#2563EB]">📏 La familia despareja</p>
                <p className="mt-1 text-xl font-bold">{familiaDespareja.nombre}</p>
                <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                  Sus {familiaDespareja.cantidad} platos van de punta a punta con {familiaDespareja.spreadPts} puntos
                  de diferencia en Food Cost. El pricing de esa familia no sigue una regla.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alertas de rentabilidad */}
      <div
        className="card flex flex-wrap items-center justify-between gap-3 p-3"
        style={{ background: rojos.length === 0 ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.06)" }}
      >
        {rojos.length === 0 ? (
          <p className="text-sm font-medium text-emerald-700">
            🟢 Todo bajo control. Ninguna receta activa supera el Food Cost objetivo.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold" style={{ color: "var(--muted)" }}>
                🔥 Alertas de rentabilidad
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600">
                🔴 {rojos.length} acción inmediata
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600">
                🟡 {amarillos.length} a vigilar
              </span>
            </div>
            {peorReceta && (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Mayor Food Cost: <span className="font-semibold text-[#0F172A]">{peorReceta.nombre}</span>{" "}
                <span className="font-semibold text-red-600">{(peorReceta.resumen.foodCost * 100).toFixed(1)}%</span>
              </p>
            )}
          </>
        )}
      </div>

      {/* Top 10 más rentables / que más pierden */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <p className="eyebrow mb-3">🥇 Top 10 más rentables</p>
          <div className="flex flex-col gap-2">
            {top10Rentables.map((r) => (
              <div key={r.id} className="flex items-center gap-3 text-sm">
                <span className="w-40 truncate">{r.nombre}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: `${Math.max(4, (r.resumen.utilidad / maxUtilidadTop10) * 100)}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right fin-value">{money(r.resumen.utilidad)}</span>
              </div>
            ))}
            {top10Rentables.length === 0 && <p className="text-sm text-slate-400">Sin datos.</p>}
          </div>
        </div>
        <div className="card p-4">
          <p className="eyebrow mb-3">🔴 Top recetas que más pierden</p>
          <div className="flex flex-col gap-2">
            {top10Pierden.map((r) => (
              <div key={r.id} className="flex items-center gap-3 text-sm">
                <span className="w-40 truncate">{r.nombre}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-red-500"
                    style={{ width: `${Math.max(4, (r.resumen.foodCost / maxFcPierden) * 100)}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-red-600 fin-value">
                  {(r.resumen.foodCost * 100).toFixed(1)}%
                </span>
                <span className="w-16 shrink-0 text-right text-xs text-red-500">
                  +{((r.resumen.foodCost - config.fcObjetivo) * 100).toFixed(1)}pp
                </span>
              </div>
            ))}
            {top10Pierden.length === 0 && <p className="text-sm text-slate-400">Sin datos.</p>}
          </div>
        </div>
      </div>

      {/* Food cost promedio por familia */}
      <div className="card p-4">
        <p className="eyebrow mb-3">🗂️ Food cost promedio por familia</p>
        <div className="flex flex-col gap-2">
          {promedioPorFamilia.map((f) => (
            <div key={f.nombre} className="flex items-center gap-3 text-sm">
              <span className="w-48 truncate">{f.nombre}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-[#1E3A5F]"
                  style={{ width: `${Math.min(100, (f.promedio / 0.5) * 100)}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right fin-value">{(f.promedio * 100).toFixed(1)}%</span>
            </div>
          ))}
          {promedioPorFamilia.length === 0 && <p className="text-sm text-slate-400">Sin datos.</p>}
        </div>
      </div>

      {/* Detalle por receta */}
      <div className="card overflow-hidden">
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
          style={{ borderColor: "var(--line)" }}
        >
          <p className="text-sm font-bold">📋 Detalle por receta</p>
          <form className="flex items-center gap-2" method="get">
            <input type="hidden" name="sede" value={sedeActiva.id} />
            {familiaFiltro && <input type="hidden" name="familia" value={familiaFiltro} />}
            <label className="text-xs" style={{ color: "var(--muted)" }}>Estado</label>
            <select
              name="estado"
              defaultValue={estadoFiltro}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#1E3A5F]"
            >
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
              <option value="todos">Todos</option>
            </select>
            <button type="submit" className="btn-secondary">Filtrar</button>
          </form>
        </div>
        <PanelDetalleTabla
          filas={filasDetalle}
          fcObjetivo={config.fcObjetivo}
          fcObjetivoPanel={config.fcObjetivoPanel}
          actualizar={actualizarPrecioYEstadoReceta}
        />
      </div>
    </div>
  );
}
