import { notFound } from "next/navigation";
import { obtenerReceta, listarFamiliasParaPicker } from "@/lib/data/recetas";
import {
  listarIngredientesDeReceta,
  listarInsumosParaPicker,
  listarSubrecetasParaPicker,
} from "@/lib/data/ingredientes";
import { calcularResumenCosteo } from "@/lib/costeo";
import { obtenerFichaPorReceta } from "@/lib/data/fichas";
import { listarHistorialReceta } from "@/lib/data/historial";
import {
  actualizarReceta,
  agregarIngredienteReceta,
  eliminarIngredienteReceta,
  guardarFicha,
} from "../actions";

const CHIP_SEMAFORO: Record<string, string> = {
  verde: "chip-success",
  amarillo: "chip-warning",
  rojo: "chip-danger",
};

const inputClase =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#1E3A5F]";

export default async function EditarRecetaPage({
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

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="eyebrow">Receta</p>
        <h1 className="text-xl font-semibold">{receta.nombre}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Costo total: <span className="fin-value">{receta.costo_total.toFixed(2)}</span> · Costo porción:{" "}
          <span className="fin-value">{receta.costo_porcion.toFixed(2)}</span>
        </p>
      </div>

      {resumen && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card p-4">
            <p className="eyebrow">Food cost</p>
            <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
              <span className="fin-value">{(resumen.foodCost * 100).toFixed(1)}%</span>
              <span className={`chip ${CHIP_SEMAFORO[resumen.semaforo]}`}>
                {resumen.semaforo}
              </span>
            </p>
          </div>
          <div className="card p-4">
            <p className="eyebrow">Precio sugerido (35%)</p>
            <p className="mt-1 text-lg font-semibold fin-value">{resumen.precioSugerido.toFixed(2)}</p>
          </div>
          <div className="card p-4">
            <p className="eyebrow">Precio sugerido Panel (30%)</p>
            <p className="mt-1 text-lg font-semibold fin-value">{resumen.precioSugeridoPanel.toFixed(2)}</p>
          </div>
          <div className="card p-4">
            <p className="eyebrow">Margen bruto</p>
            <p className="mt-1 text-lg font-semibold fin-value">{(resumen.margenBruto * 100).toFixed(1)}%</p>
          </div>
        </div>
      )}

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

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Ingredientes</h2>
        <div className="card overflow-hidden">
          <div className="erp-scroll">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Ítem</th>
                  <th className="text-right">Cantidad</th>
                  <th>Unidad</th>
                  <th className="text-right">Merma %</th>
                  <th className="text-right">Costo unitario</th>
                  <th className="text-right">Costo línea</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ingredientes.map((i) => (
                  <tr key={i.id}>
                    <td>{i.descripcion}</td>
                    <td className="text-right">{i.cantidad}</td>
                    <td>{i.unidad_codigo ?? "—"}</td>
                    <td className="text-right">{(i.merma_pct * 100).toFixed(1)}</td>
                    <td className="text-right fin-value">{i.costo_unitario.toFixed(4)}</td>
                    <td className="text-right fin-value">{i.costo_linea.toFixed(2)}</td>
                    <td className="text-right">
                      <form action={eliminarIngredienteReceta}>
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="receta_id" value={receta.id} />
                        <button type="submit" className="btn-danger px-2 py-1 text-xs">
                          Quitar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {ingredientes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                      Todavía no tiene ingredientes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <form action={agregarIngredienteReceta} className="card flex flex-col gap-2 p-3">
          <h3 className="text-sm font-semibold">Agregar insumo</h3>
          <input type="hidden" name="sede_id" value={receta.sede_id} />
          <input type="hidden" name="receta_id" value={receta.id} />
          <input type="hidden" name="tipo_item" value="insumo" />
          <input type="hidden" name="orden" value={siguienteOrden} />
          <select name="insumo_id" required className={inputClase}>
            <option value="">— Elegir insumo —</option>
            {insumos.map((i) => (
              <option key={i.id} value={i.id}>
                {i.etiqueta} ({i.coste.toFixed(2)}/{i.unidad_codigo ?? "?"})
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              name="cantidad"
              type="number"
              step="0.01"
              required
              placeholder="Cantidad"
              className={`w-28 ${inputClase}`}
            />
            <input name="unidad_codigo" placeholder="Unidad" className={`w-20 ${inputClase}`} />
            <input
              name="merma_pct"
              type="number"
              step="0.01"
              placeholder="Merma %"
              className={`w-24 ${inputClase}`}
            />
          </div>
          <button type="submit" className="btn-secondary self-start">
            Agregar
          </button>
        </form>

        <form action={agregarIngredienteReceta} className="card flex flex-col gap-2 p-3">
          <h3 className="text-sm font-semibold">Agregar subreceta</h3>
          <input type="hidden" name="sede_id" value={receta.sede_id} />
          <input type="hidden" name="receta_id" value={receta.id} />
          <input type="hidden" name="tipo_item" value="subreceta" />
          <input type="hidden" name="orden" value={siguienteOrden} />
          <select name="subreceta_ref_id" required className={inputClase}>
            <option value="">— Elegir subreceta —</option>
            {subrecetas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.etiqueta} ({s.costo_unitario.toFixed(4)})
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              name="cantidad"
              type="number"
              step="0.01"
              required
              placeholder="Cantidad"
              className={`w-28 ${inputClase}`}
            />
            <input name="unidad_codigo" placeholder="Unidad" className={`w-20 ${inputClase}`} />
            <input
              name="merma_pct"
              type="number"
              step="0.01"
              placeholder="Merma %"
              className={`w-24 ${inputClase}`}
            />
          </div>
          <button type="submit" className="btn-secondary self-start">
            Agregar
          </button>
        </form>
      </div>

      <div>
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
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Historial de versiones</h2>
        {historial.length === 0 ? (
          <p className="text-sm text-slate-400">Todavía no hay versiones guardadas.</p>
        ) : (
          <div className="card overflow-hidden">
            <div className="erp-scroll">
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
          </div>
        )}
      </div>
    </div>
  );
}
