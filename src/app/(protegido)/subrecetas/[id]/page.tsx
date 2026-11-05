import Link from "next/link";
import { notFound } from "next/navigation";
import { getUsuarioActual, tieneModulo } from "@/lib/auth/usuario-actual";
import { obtenerSubreceta } from "@/lib/data/subrecetas";
import { listarIngredientesDeSubreceta } from "@/lib/data/ingredientes";
import { obtenerFichaPorSubreceta } from "@/lib/data/fichas-subrecetas";
import { listarHistorialSubreceta } from "@/lib/data/historial-subrecetas";
import SubidaFoto from "@/components/SubidaFoto";
import { actualizarFotoSubreceta, guardarFichaSubreceta } from "../actions";

// Misma razón que recetas/[id]/page.tsx: esta pantalla se abre siempre
// justo después de crear/editar la subreceta (redirect desde el
// formulario), así que se fuerza a que siempre se renderice de nuevo con
// los datos frescos de Supabase.
export const dynamic = "force-dynamic";

const inputClase =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#1E3A5F]";

const fecha = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—";

export default async function SubrecetaDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  if (!tieneModulo(usuario, "subrecetas")) {
    return (
      <p style={{ color: "var(--muted)" }}>
        No tenés permiso para ver esta pantalla.
      </p>
    );
  }

  const subreceta = await obtenerSubreceta(params.id);
  if (!subreceta) notFound();

  const [ingredientes, ficha, historial] = await Promise.all([
    listarIngredientesDeSubreceta(subreceta.id),
    obtenerFichaPorSubreceta(subreceta.id),
    listarHistorialSubreceta(subreceta.id),
  ]);

  const subrecetaId = subreceta.id;
  async function guardarFotoSubreceta(url: string) {
    "use server";
    await actualizarFotoSubreceta(subrecetaId, url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow">
          <Link href={`/subrecetas?sede=${subreceta.sede_id}`} className="hover:underline">
            Subrecetas
          </Link>{" "}
          / {subreceta.nombre}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{subreceta.nombre}</h1>
          {!subreceta.activo && <span className="chip chip-warning">Inactiva</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/subrecetas?sede=${subreceta.sede_id}`} className="btn-secondary">
            Volver
          </Link>
          <a href="#ficha-tecnica" className="btn-secondary">
            📋 Ficha técnica
          </a>
          <Link href={`/subrecetas/nueva?edit=${subreceta.id}&sede=${subreceta.sede_id}`} className="btn-primary">
            ✎ Editar subreceta
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <SubidaFoto
            sedeId={subreceta.sede_id}
            tipo="subreceta"
            itemId={subreceta.id}
            fotoUrl={subreceta.foto_url}
            guardar={guardarFotoSubreceta}
          />
          <a
            href={`/subrecetas/${subreceta.id}/pdf`}
            className="btn-secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            ⬇ Descargar PDF
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <p className="eyebrow">Costo total</p>
          <p className="mt-1 text-lg font-semibold fin-value">{money(subreceta.costo_total)}</p>
        </div>
        <div className="card p-4" style={{ background: "rgba(34,197,94,0.08)" }}>
          <p className="eyebrow">Costo unitario</p>
          <p className="mt-1 text-lg font-semibold fin-value text-emerald-700">
            {subreceta.costo_unitario.toFixed(4)}
            {subreceta.unidad_rendimiento_codigo ? ` / ${subreceta.unidad_rendimiento_codigo}` : ""}
          </p>
        </div>
      </div>

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
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Rendimiento</p>
                <p className="mt-1 text-sm font-medium">
                  {subreceta.rendimiento ?? "—"} {subreceta.unidad_rendimiento_codigo ?? ""}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Creada</p>
                <p className="mt-1 text-sm font-medium">{fecha(subreceta.creado_en)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Actualizada</p>
                <p className="mt-1 text-sm font-medium">{fecha(subreceta.actualizado_en)}</p>
              </div>
            </div>
          </section>

          {/* Solo lectura: los ingredientes se editan desde "Editar
              subreceta" (la misma pantalla de creación, reutilizada),
              igual que Recetas — acá no hay alta/baja de líneas suelta. */}
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
                <tfoot>
                  <tr>
                    <td colSpan={6} className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Costo total
                    </td>
                    <td className="px-4 py-2 text-right fin-value font-semibold">{money(subreceta.costo_total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
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
                      <th className="text-right">Costo unitario</th>
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
                          {Number(h.snapshot?.subreceta?.costo_unitario ?? 0).toFixed(4)}
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
              <span>Desvío de mercancía</span>
              <span>{(subreceta.desvio_pct * 100).toFixed(1)}%</span>
            </div>
            <div className="ticket-total">
              <span>Costo total</span>
              <span>{money(subreceta.costo_total)}</span>
            </div>
            <div className="my-1 border-t border-dashed" style={{ borderColor: "var(--line)" }} />
            <div className="ticket-row">
              <span>Costo unitario</span>
              <span>
                {subreceta.costo_unitario.toFixed(4)}
                {subreceta.unidad_rendimiento_codigo ? ` / ${subreceta.unidad_rendimiento_codigo}` : ""}
              </span>
            </div>
          </div>
        </aside>
      </div>

      <section id="ficha-tecnica">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Ficha técnica</h2>
        <form action={guardarFichaSubreceta} className="card flex max-w-2xl flex-col gap-3 p-3">
          <input type="hidden" name="subreceta_id" value={subreceta.id} />
          <input type="hidden" name="sede_id" value={subreceta.sede_id} />

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
    </div>
  );
}

function money(n: number) {
  return "$" + (n || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });
}
