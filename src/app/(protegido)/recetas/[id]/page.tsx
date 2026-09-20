import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerReceta, listarFamiliasParaPicker } from "@/lib/data/recetas";
import {
  listarIngredientesDeReceta,
  listarInsumosParaPicker,
  listarSubrecetasParaPicker,
} from "@/lib/data/ingredientes";
import { calcularResumenCosteo, FC_OBJ } from "@/lib/costeo";
import { obtenerFichaPorReceta } from "@/lib/data/fichas";
import { listarHistorialReceta } from "@/lib/data/historial";
import SubidaFoto from "@/components/SubidaFoto";
import FilaAgregarIngrediente from "@/components/FilaAgregarIngrediente";
import {
  actualizarReceta,
  actualizarFotoReceta,
  agregarIngredienteReceta,
  eliminarIngredienteReceta,
  guardarFicha,
} from "../actions";

const CHIP_SEMAFORO: Record<string, string> = {
  verde: "chip-success",
  amarillo: "chip-warning",
  rojo: "chip-danger",
};

const ETIQUETA_SEMAFORO: Record<string, string> = {
  verde: "Rentable",
  amarillo: "Alerta",
  rojo: "Crítico",
};

const RENTABILIDAD_SEMAFORO: Record<string, string> = {
  verde: "Rentable",
  amarillo: "Revisar precio",
  rojo: "Revisar precio",
};

const inputClase =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#1E3A5F]";

const money = (n: number) => "$" + (n || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });
const fecha = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—";

export default async function RecetaDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const receta = await obtenerReceta(params.id);
  if (!receta) notFound();

  const [ingredientes, insumos, subrecetas, familias, ficha, historial] = await Promise.all([
    listarIngredientesDeReceta(receta.id),
    listarInsumosParaPicker(receta.sede_id),
    listarSubrecetasParaPicker(receta.sede_id),
    listarFamiliasParaPicker(receta.sede_id),
    obtenerFichaPorReceta(receta.id),
    listarHistorialReceta(receta.id),
  ]);

  const siguienteOrden = ingredientes.length
    ? Math.max(...ingredientes.map((i) => i.orden)) + 1
    : 1;

  const resumen = receta.precio_real
    ? calcularResumenCosteo(receta.costo_porcion, receta.precio_real)
    : null;

  // El costo de ingredientes y el costo por merma no se guardan aparte —
  // se derivan de las mismas líneas que arma la tabla, igual que hace el
  // panel de costeo al crear la receta (costo_unitario × cantidad = antes
  // de merma; costo_linea ya la trae aplicada).
  const costoBaseSinMerma = ingredientes.reduce((s, i) => s + i.costo_unitario * i.cantidad, 0);
  const costoConMerma = ingredientes.reduce((s, i) => s + i.costo_linea, 0);
  const costoPorMerma = costoConMerma - costoBaseSinMerma;
  const desvioMonto = receta.costo_total - costoConMerma;

  const recetaId = receta.id;
  const recetaSedeId = receta.sede_id;
  async function guardarFotoReceta(url: string) {
    "use server";
    await actualizarFotoReceta(recetaId, recetaSedeId, url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow">
          <Link href={`/recetas?sede=${receta.sede_id}`} className="hover:underline">
            Recetario
          </Link>{" "}
          / {receta.nombre}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{receta.nombre}</h1>
          {resumen && (
            <span className={`chip ${CHIP_SEMAFORO[resumen.semaforo]}`}>
              Food Cost {(resumen.foodCost * 100).toFixed(2)}% · {ETIQUETA_SEMAFORO[resumen.semaforo]}
            </span>
          )}
          {!receta.activo && <span className="chip chip-warning">Inactiva</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/recetas?sede=${receta.sede_id}`} className="btn-secondary">
            Volver
          </Link>
          <a href="#ficha-tecnica" className="btn-secondary">
            📋 Ficha técnica
          </a>
          <a href="#editar" className="btn-primary">
            ✎ Editar receta
          </a>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <SubidaFoto
            sedeId={receta.sede_id}
            tipo="receta"
            itemId={receta.id}
            fotoUrl={ficha?.foto_url ?? null}
            guardar={guardarFotoReceta}
          />
          <a href={`/recetas/${receta.id}/pdf`} className="btn-secondary" target="_blank" rel="noopener noreferrer">
            ⬇ Descargar PDF
          </a>
        </div>
      </div>

      {resumen && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card p-4">
            <p className="eyebrow">Costo del plato</p>
            <p className="mt-1 text-lg font-semibold fin-value">{money(receta.costo_porcion)}</p>
          </div>
          <div className="card p-4" style={{ background: "rgba(34,197,94,0.08)" }}>
            <p className="eyebrow">Precio sugerido</p>
            <p className="mt-1 text-lg font-semibold fin-value text-emerald-700">
              {money(resumen.precioSugerido)}
            </p>
          </div>
          <div className="card p-4">
            <p className="eyebrow">Precio real</p>
            <p className="mt-1 text-lg font-semibold fin-value">{money(receta.precio_real ?? 0)}</p>
          </div>
          <div className="card p-4" style={{ background: "rgba(34,197,94,0.08)" }}>
            <p className="eyebrow">Utilidad</p>
            <p className="mt-1 text-lg font-semibold fin-value text-emerald-700">
              {money(resumen.utilidad)}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <section className="card p-4">
            <p
              className="mb-3 border-b pb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500"
              style={{ borderColor: "var(--line)" }}
            >
              Información general
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Familia</p>
                <p className="mt-1 text-sm font-medium">{receta.familia_nombre ?? "General"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Rendimiento</p>
                <p className="mt-1 text-sm font-medium">
                  {receta.rendimiento ?? "—"} {receta.unidad_rendimiento_codigo ?? ""}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Creada</p>
                <p className="mt-1 text-sm font-medium">{fecha(receta.creado_en)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Actualizada</p>
                <p className="mt-1 text-sm font-medium">{fecha(receta.actualizado_en)}</p>
              </div>
            </div>
          </section>

          <section className="card overflow-hidden">
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: "var(--line)" }}
            >
              <p className="text-sm font-semibold">Ingredientes ({ingredientes.length})</p>
            </div>
            <div className="erp-scroll">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Insumo</th>
                    <th>Unidad</th>
                    <th className="text-right">Cantidad</th>
                    <th className="text-right">% Merma</th>
                    <th className="text-right">Cant. real</th>
                    <th className="text-right">Costo unit.</th>
                    <th className="text-right">Costo total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ingredientes.map((i) => (
                    <tr key={i.id}>
                      <td className="font-medium">{i.descripcion}</td>
                      <td>{i.unidad_codigo ?? "—"}</td>
                      <td className="text-right">{i.cantidad}</td>
                      <td className="text-right">{(i.merma_pct * 100).toFixed(1)}%</td>
                      <td className="whitespace-nowrap text-right font-mono text-xs text-slate-600">
                        {(i.cantidad / (1 - Math.min(i.merma_pct, 0.949))).toFixed(2)}
                      </td>
                      <td className="text-right fin-value">{money(i.costo_unitario)}</td>
                      <td className="text-right fin-value">{money(i.costo_linea)}</td>
                      <td className="text-right">
                        <form action={eliminarIngredienteReceta}>
                          <input type="hidden" name="id" value={i.id} />
                          <input type="hidden" name="receta_id" value={recetaId} />
                          <button type="submit" className="btn-danger px-2 py-1 text-xs">
                            Quitar
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {ingredientes.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                        Todavía no tiene ingredientes.
                      </td>
                    </tr>
                  )}
                  <FilaAgregarIngrediente
                    formId="agregar-ing-receta"
                    variant="receta"
                    insumos={insumos}
                    subrecetas={subrecetas}
                  />
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6} className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Costo de ingredientes
                    </td>
                    <td className="px-4 py-2 text-right fin-value font-semibold">{money(costoConMerma)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <form id="agregar-ing-receta" action={agregarIngredienteReceta}>
              <input type="hidden" name="sede_id" value={recetaSedeId} />
              <input type="hidden" name="receta_id" value={recetaId} />
              <input type="hidden" name="orden" value={siguienteOrden} />
            </form>
          </section>

          {historial.length > 0 && (
            <details className="card overflow-hidden">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-700">
                Historial de versiones ({historial.length})
              </summary>
              <div className="erp-scroll border-t" style={{ borderColor: "var(--line)" }}>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Versión</th>
                      <th>Fecha</th>
                      <th>Acción</th>
                      <th>Usuario</th>
                      <th className="text-right">Costo porción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((h) => (
                      <tr key={h.id}>
                        <td>v{h.version}</td>
                        <td>{new Date(h.fecha).toLocaleString("es-CO")}</td>
                        <td>{h.accion ?? "—"}</td>
                        <td>{h.usuario_nombre ?? "—"}</td>
                        <td className="text-right fin-value">
                          {Number(h.snapshot?.receta?.costo_porcion ?? 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>

        <aside className="flex flex-col gap-4 self-start">
          <div className="ticket-panel">
            <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-[#1E3A5F]">
              Resumen de costos
            </p>
            <div className="ticket-row">
              <span>Costo de ingredientes</span>
              <span>{money(costoBaseSinMerma)}</span>
            </div>
            <div className="ticket-row">
              <span>Costo por merma</span>
              <span>{money(costoPorMerma)}</span>
            </div>
            <div className="ticket-row">
              <span>Desvío de mercancía</span>
              <span>{(receta.desvio_pct * 100).toFixed(1)}% · {money(desvioMonto)}</span>
            </div>
            <div className="ticket-total">
              <span>Costo total del plato</span>
              <span>{money(receta.costo_total)}</span>
            </div>
            <div className="my-1 border-t border-dashed" style={{ borderColor: "var(--line)" }} />
            <div className="ticket-row">
              <span>Costo por porción</span>
              <span>{money(receta.costo_porcion)}</span>
            </div>
            <div className="ticket-row">
              <span>Food cost objetivo</span>
              <span>{(FC_OBJ * 100).toFixed(0)}%</span>
            </div>
            {resumen ? (
              <>
                <div className="my-1 border-t border-dashed" style={{ borderColor: "var(--line)" }} />
                <div className="ticket-row font-semibold text-[#1E3A5F]">
                  <span>Precio sugerido</span>
                  <span>{money(resumen.precioSugerido)}</span>
                </div>
                <div className="ticket-row">
                  <span>Precio real de venta</span>
                  <span>{money(resumen.precioReal)}</span>
                </div>
                <div className="ticket-row">
                  <span>Food cost real</span>
                  <span className={`chip ${CHIP_SEMAFORO[resumen.semaforo]}`}>
                    {(resumen.foodCost * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="ticket-row">
                  <span>Utilidad</span>
                  <span>{money(resumen.utilidad)}</span>
                </div>
                <div className="ticket-row">
                  <span>Margen bruto</span>
                  <span>{(resumen.margenBruto * 100).toFixed(2)}%</span>
                </div>
                <div className="ticket-total">
                  <span>Rentabilidad</span>
                  <span>{RENTABILIDAD_SEMAFORO[resumen.semaforo]}</span>
                </div>
              </>
            ) : (
              <p className="mt-2 text-xs text-slate-400">
                Todavía no tiene precio real de venta cargado.
              </p>
            )}
          </div>
        </aside>
      </div>

      <section id="ficha-tecnica">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Ficha técnica</h2>
        <form action={guardarFicha} className="card flex max-w-2xl flex-col gap-3 p-3">
          <input type="hidden" name="receta_id" value={receta.id} />
          <input type="hidden" name="sede_id" value={receta.sede_id} />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--muted)" }}>Tiempo de preparación (min)</label>
              <input
                name="tiempo_min"
                type="number"
                step="1"
                defaultValue={ficha?.tiempo_min ?? ""}
                className={inputClase}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--muted)" }}>Gramaje por porción</label>
              <input
                name="gramaje_porcion"
                type="number"
                step="0.01"
                defaultValue={ficha?.gramaje_porcion ?? ""}
                className={inputClase}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--muted)" }}>Preparación</label>
            <textarea
              name="preparacion"
              rows={4}
              defaultValue={ficha?.preparacion ?? ""}
              className={inputClase}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--muted)" }}>Emplatado</label>
            <textarea
              name="emplatado"
              rows={3}
              defaultValue={ficha?.emplatado ?? ""}
              className={inputClase}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--muted)" }}>Notas</label>
            <textarea
              name="notas"
              rows={2}
              defaultValue={ficha?.notas ?? ""}
              className={inputClase}
            />
          </div>

          <button type="submit" className="btn-secondary self-start">
            Guardar ficha técnica
          </button>
        </form>
      </section>

      <section id="editar" className="flex flex-col gap-4 border-t pt-6" style={{ borderColor: "var(--line)" }}>
        <h2 className="text-sm font-semibold text-slate-700">Edición avanzada</h2>

        <form action={actualizarReceta} className="card flex flex-wrap items-end gap-3 p-3">
          <input type="hidden" name="id" value={receta.id} />
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--muted)" }}>Nombre</label>
            <input name="nombre" defaultValue={receta.nombre} className={inputClase} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--muted)" }}>Familia</label>
            <select
              name="familia_id"
              defaultValue={receta.familia_id ?? ""}
              className={inputClase}
            >
              <option value="">— Sin familia —</option>
              {familias.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--muted)" }}>Rendimiento</label>
            <input
              name="rendimiento"
              type="number"
              step="0.01"
              defaultValue={receta.rendimiento ?? ""}
              className={`w-24 ${inputClase}`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--muted)" }}>Unidad</label>
            <input
              name="unidad_rendimiento_codigo"
              defaultValue={receta.unidad_rendimiento_codigo ?? ""}
              className={`w-20 ${inputClase}`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--muted)" }}>Precio real</label>
            <input
              name="precio_real"
              type="number"
              step="0.01"
              defaultValue={receta.precio_real ?? ""}
              className={`w-28 ${inputClase}`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--muted)" }}>IVA %</label>
            <input
              name="iva"
              type="number"
              step="0.01"
              defaultValue={(receta.iva * 100).toFixed(2)}
              className={`w-20 ${inputClase}`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--muted)" }}>Merma %</label>
            <input
              name="merma_pct"
              type="number"
              step="0.01"
              defaultValue={(receta.merma_pct * 100).toFixed(2)}
              className={`w-20 ${inputClase}`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--muted)" }}>Desvío %</label>
            <input
              name="desvio_pct"
              type="number"
              step="0.01"
              defaultValue={(receta.desvio_pct * 100).toFixed(2)}
              className={`w-20 ${inputClase}`}
            />
          </div>
          <label className="flex items-center gap-1 text-sm text-slate-600">
            <input type="checkbox" name="activo" defaultChecked={receta.activo} />
            Activa
          </label>
          <button type="submit" className="btn-secondary">
            Guardar
          </button>
        </form>
      </section>
    </div>
  );
}
