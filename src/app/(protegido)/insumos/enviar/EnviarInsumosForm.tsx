"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { previsualizarEnvio, aplicarEnvio } from "./actions";
import type { EstadoEnvio } from "./actions";
import type { SedeConMarca } from "@/lib/data/sedes";

function BotonPrevisualizar({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className="btn-primary self-start">
      {pending ? "Revisando…" : "Previsualizar"}
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
        if (!confirm(`¿Enviar? Se van a crear ${cantidad} insumo(s) nuevo(s) en la sede destino.`)) {
          e.preventDefault();
        }
      }}
    >
      {pending ? "Enviando…" : `Confirmar y enviar (${cantidad})`}
    </button>
  );
}

const estadoInicial: EstadoEnvio = { error: null, plan: null };

export default function EnviarInsumosForm({
  sedeOrigenId,
  insumoIds,
  sedesDestino,
}: {
  sedeOrigenId: string;
  insumoIds: string[];
  sedesDestino: SedeConMarca[];
}) {
  const [estado, formAction] = useFormState(previsualizarEnvio, estadoInicial);
  const [sedeDestinoId, setSedeDestinoId] = useState(sedesDestino[0]?.id ?? "");

  const plan = estado.plan;
  const itemsACrear = plan ? plan.items.filter((i) => !i.yaExisteEnDestino) : [];

  if (sedesDestino.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        No hay otra marca/sede visible a la que mandar estos insumos.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="card flex max-w-xl flex-col gap-4 p-5">
        <input type="hidden" name="sede_origen_id" value={sedeOrigenId} />
        <input type="hidden" name="insumo_ids" value={insumoIds.join(",")} />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Enviar a</label>
          <select
            name="sede_destino_id"
            value={sedeDestinoId}
            onChange={(e) => setSedeDestinoId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
          >
            {sedesDestino.map((s) => (
              <option key={s.id} value={s.id}>
                {s.marca_nombre} / {s.nombre}
              </option>
            ))}
          </select>
        </div>

        {estado.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {estado.error}
          </p>
        )}

        <BotonPrevisualizar disabled={!sedeDestinoId} />
      </form>

      {plan && (
        <div className="card flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Vista previa</h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              <strong>{plan.resumen.aCrear}</strong> se van a crear como insumos nuevos en la
              sede destino, y <strong>{plan.resumen.yaExisten}</strong> ya existen ahí con ese
              mismo nombre — esos no se van a tocar.
            </p>
          </div>

          <div className="erp-scroll max-h-96">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Artículo</th>
                  <th>Estado</th>
                  <th className="text-right">Costo</th>
                </tr>
              </thead>
              <tbody>
                {plan.items.map((item) => (
                  <tr key={item.insumoId}>
                    <td className="font-medium">{item.articulo}</td>
                    <td style={{ color: "var(--muted)" }}>
                      {item.yaExisteEnDestino
                        ? "Ya existe en destino — no se toca"
                        : "Se crea nuevo"}
                    </td>
                    <td className="text-right fin-value">
                      {item.coste.toLocaleString("es-CO", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form action={aplicarEnvio} className="flex flex-col gap-2">
            <input type="hidden" name="sede_origen_id" value={sedeOrigenId} />
            <input type="hidden" name="sede_destino_id" value={plan.sedeDestinoId} />
            <input type="hidden" name="items_json" value={JSON.stringify(itemsACrear)} />
            <BotonAplicar cantidad={itemsACrear.length} />
          </form>
        </div>
      )}
    </div>
  );
}
