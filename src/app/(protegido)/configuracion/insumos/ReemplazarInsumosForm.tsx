"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { previsualizarReemplazo, aplicarReemplazo, borrarInsumosMarca } from "./actions";
import type { EstadoReemplazo } from "./actions";

export type MarcaConSedesYConteo = {
  id: string;
  nombre: string;
  activo: boolean;
  sedes: { id: string; nombre: string; activo: boolean }[];
  cantidadInsumosActivos: number;
};

const estadoInicial: EstadoReemplazo = { error: null, marcaId: null, marcaNombre: null, planes: null };

function BotonPrevisualizar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary self-start">
      {pending ? "Leyendo archivos…" : "Previsualizar"}
    </button>
  );
}

function BotonAplicar({ cantidad }: { cantidad: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || cantidad === 0}
      className="btn-primary self-start"
      onClick={(e) => {
        if (
          !confirm(`¿Aplicar esta carga? Se van a crear/actualizar ${cantidad} insumo(s) en total.`)
        ) {
          e.preventDefault();
        }
      }}
    >
      {pending ? "Aplicando…" : `Confirmar y aplicar (${cantidad})`}
    </button>
  );
}

function PanelReemplazo({ marca }: { marca: MarcaConSedesYConteo }) {
  const [estado, formAction] = useFormState(previsualizarReemplazo, estadoInicial);

  const planes = estado.planes;
  const totalAAplicar =
    planes?.reduce((acc, p) => acc + p.items.filter((i) => i.accion !== "sin_cambio").length, 0) ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="card flex flex-col gap-4 p-5" style={{ maxWidth: 640 }}>
        <input type="hidden" name="marca_id" value={marca.id} />
        <div className="flex flex-col gap-3">
          {marca.sedes.map((sede) => (
            <div key={sede.id} className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">
                Archivo de &quot;{sede.nombre}&quot; (.xlsx)
              </label>
              <input
                type="file"
                name={`archivo_${sede.id}`}
                accept=".xlsx"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
              />
            </div>
          ))}
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Dejá vacío el de cualquier sede que todavía no tenga archivo listo — se puede hacer de
            a una sede por vez, o todas juntas.
          </p>
        </div>

        {estado.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {estado.error}
          </p>
        )}

        <BotonPrevisualizar />
      </form>

      {planes && planes.length > 0 && (
        <div className="card flex flex-col gap-4 p-5" style={{ maxWidth: 640 }}>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Vista previa</h2>
            {planes.map((p) => (
              <p key={p.sedeId} className="text-sm" style={{ color: "var(--muted)" }}>
                <strong>{p.sedeNombre}:</strong> {p.totalFilasArchivo} filas en el archivo —{" "}
                {p.filasSubrecetaIgnoradas} son subrecetas (no se tocan), {p.resumen.sinCambio} ya
                están igual, <strong>{p.resumen.aActualizar}</strong> van a actualizar y{" "}
                <strong>{p.resumen.aCrear}</strong> se van a crear.
              </p>
            ))}
          </div>

          {planes.map((p) => {
            const itemsSede = p.items.filter((i) => i.accion !== "sin_cambio");
            if (itemsSede.length === 0) return null;
            return (
              <div key={p.sedeId} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{p.sedeNombre}</h3>
                <div className="erp-scroll max-h-72">
                  <table className="erp-table">
                    <thead>
                      <tr>
                        <th>Artículo</th>
                        <th>Acción</th>
                        <th className="text-right">Costo anterior</th>
                        <th className="text-right">Costo nuevo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemsSede.map((item, indice) => (
                        <tr key={`${item.articulo}-${indice}`}>
                          <td className="font-medium">{item.articulo}</td>
                          <td style={{ color: "var(--muted)" }}>
                            {item.accion === "crear" ? "Insumo nuevo" : "Actualizar"}
                          </td>
                          <td className="text-right fin-value">
                            {item.costeAnterior !== null
                              ? item.costeAnterior.toLocaleString("es-CO", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : "—"}
                          </td>
                          <td className="text-right fin-value">
                            {item.costeArchivo.toLocaleString("es-CO", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          <form action={aplicarReemplazo} className="flex flex-col gap-2">
            <input type="hidden" name="marca_id" value={marca.id} />
            <input type="hidden" name="planes_json" value={JSON.stringify(planes)} />
            <BotonAplicar cantidad={totalAAplicar} />
          </form>
        </div>
      )}
    </div>
  );
}

function BotonBorrar({ marcaNombre, confirmacion }: { marcaNombre: string; confirmacion: string }) {
  const { pending } = useFormStatus();
  const habilitado = confirmacion === marcaNombre;
  return (
    <button
      type="submit"
      disabled={pending || !habilitado}
      className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
      style={{ borderColor: "#fca5a5", color: "#b91c1c" }}
      onClick={(e) => {
        if (
          !confirm(`¿Desactivar TODOS los insumos de "${marcaNombre}"? No se puede deshacer fácil.`)
        ) {
          e.preventDefault();
        }
      }}
    >
      {pending ? "Borrando…" : `Borrar insumos de "${marcaNombre}"`}
    </button>
  );
}

function PanelBorrar({ marca }: { marca: MarcaConSedesYConteo }) {
  const [confirmacion, setConfirmacion] = useState("");
  return (
    <div
      className="card flex flex-col gap-3 border p-5"
      style={{ maxWidth: 640, borderColor: "#fca5a5" }}
    >
      <div>
        <h2 className="text-base font-semibold" style={{ color: "#b91c1c" }}>
          Borrar insumos de &quot;{marca.nombre}&quot;
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Hoy hay <strong>{marca.cantidadInsumosActivos}</strong> insumo(s) activo(s) en las{" "}
          {marca.sedes.length} sede(s) de esta marca. Esto los desactiva a todos — no los borra de
          verdad: las recetas y subrecetas que ya los usan siguen funcionando igual, pero dejan de
          aparecer para elegir en recetas nuevas. No hay un botón para reactivarlos todos de nuevo
          de una sola vez.
        </p>
      </div>
      <form action={borrarInsumosMarca} className="flex flex-col gap-2">
        <input type="hidden" name="marca_id" value={marca.id} />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Para confirmar, escribí el nombre de la marca: {marca.nombre}
          </span>
          <input
            type="text"
            name="confirmacion"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            placeholder={marca.nombre}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
          />
        </label>
        <BotonBorrar marcaNombre={marca.nombre} confirmacion={confirmacion} />
      </form>
    </div>
  );
}

export default function ReemplazarInsumosForm({
  marcas,
  marcaPreseleccionada,
}: {
  marcas: MarcaConSedesYConteo[];
  marcaPreseleccionada: string | null;
}) {
  const [marcaId, setMarcaId] = useState(
    marcaPreseleccionada && marcas.some((m) => m.id === marcaPreseleccionada)
      ? marcaPreseleccionada
      : marcas[0]?.id ?? ""
  );
  const marca = marcas.find((m) => m.id === marcaId) ?? marcas[0];

  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-1" style={{ maxWidth: 320 }}>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Marca</span>
        <select
          value={marcaId}
          onChange={(e) => setMarcaId(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#1E3A5F]"
        >
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre} ({m.sedes.length} sede{m.sedes.length === 1 ? "" : "s"})
            </option>
          ))}
        </select>
      </label>

      {marca && <PanelReemplazo key={marca.id} marca={marca} />}
      {marca && <PanelBorrar key={`borrar-${marca.id}`} marca={marca} />}
    </div>
  );
}
