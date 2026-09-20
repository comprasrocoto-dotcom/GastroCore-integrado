import { notFound } from "next/navigation";
import { obtenerSubreceta } from "@/lib/data/subrecetas";
import {
  listarIngredientesDeSubreceta,
  listarInsumosParaPicker,
  listarSubrecetasParaPicker,
} from "@/lib/data/ingredientes";
import SubidaFoto from "@/components/SubidaFoto";
import {
  actualizarSubreceta,
  actualizarFotoSubreceta,
  agregarIngredienteSubreceta,
  eliminarIngredienteSubreceta,
} from "../actions";

const inputClase =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#1E3A5F]";

export default async function EditarSubrecetaPage({
  params,
}: {
  params: { id: string };
}) {
  const subreceta = await obtenerSubreceta(params.id);
  if (!subreceta) notFound();

  const [ingredientes, insumos, subrecetas] = await Promise.all([
    listarIngredientesDeSubreceta(subreceta.id),
    listarInsumosParaPicker(subreceta.sede_id),
    listarSubrecetasParaPicker(subreceta.sede_id, subreceta.id),
  ]);

  const siguienteOrden = ingredientes.length
    ? Math.max(...ingredientes.map((i) => i.orden)) + 1
    : 1;

  const subrecetaId = subreceta.id;
  async function guardarFotoSubreceta(url: string) {
    "use server";
    await actualizarFotoSubreceta(subrecetaId, url);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="eyebrow">Subreceta</p>
        <h1 className="text-xl font-semibold">{subreceta.nombre}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Costo total: <span className="fin-value">{subreceta.costo_total.toFixed(2)}</span> · Costo unitario:{" "}
          <span className="fin-value">{subreceta.costo_unitario.toFixed(4)}</span>
          {subreceta.unidad_rendimiento_codigo
            ? ` / ${subreceta.unidad_rendimiento_codigo}`
            : ""}
        </p>
        <div className="mt-3">
          <SubidaFoto
            sedeId={subreceta.sede_id}
            tipo="subreceta"
            itemId={subreceta.id}
            fotoUrl={subreceta.foto_url}
            guardar={guardarFotoSubreceta}
          />
        </div>
      </div>

      <form action={actualizarSubreceta} className="card flex flex-wrap items-end gap-3 p-3">
        <input type="hidden" name="id" value={subreceta.id} />
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--muted)" }}>Nombre</label>
          <input name="nombre" defaultValue={subreceta.nombre} className={inputClase} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--muted)" }}>Rendimiento</label>
          <input
            name="rendimiento"
            type="number"
            step="0.01"
            defaultValue={subreceta.rendimiento ?? ""}
            className={`w-28 ${inputClase}`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--muted)" }}>Unidad</label>
          <input
            name="unidad_rendimiento_codigo"
            defaultValue={subreceta.unidad_rendimiento_codigo ?? ""}
            className={`w-24 ${inputClase}`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--muted)" }}>Merma %</label>
          <input
            name="merma_pct"
            type="number"
            step="0.01"
            defaultValue={(subreceta.merma_pct * 100).toFixed(2)}
            className={`w-20 ${inputClase}`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--muted)" }}>Desvío %</label>
          <input
            name="desvio_pct"
            type="number"
            step="0.01"
            defaultValue={(subreceta.desvio_pct * 100).toFixed(2)}
            className={`w-20 ${inputClase}`}
          />
        </div>
        <label className="flex items-center gap-1 text-sm text-slate-600">
          <input type="checkbox" name="activo" defaultChecked={subreceta.activo} />
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
                      <form action={eliminarIngredienteSubreceta}>
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="subreceta_id" value={subreceta.id} />
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
        <form action={agregarIngredienteSubreceta} className="card flex flex-col gap-2 p-3">
          <h3 className="text-sm font-semibold">Agregar insumo</h3>
          <input type="hidden" name="sede_id" value={subreceta.sede_id} />
          <input type="hidden" name="subreceta_id" value={subreceta.id} />
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

        <form action={agregarIngredienteSubreceta} className="card flex flex-col gap-2 p-3">
          <h3 className="text-sm font-semibold">Agregar otra subreceta</h3>
          <input type="hidden" name="sede_id" value={subreceta.sede_id} />
          <input type="hidden" name="subreceta_id" value={subreceta.id} />
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
    </div>
  );
}
