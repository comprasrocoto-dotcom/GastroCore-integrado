"use client";

import { useFormState, useFormStatus } from "react-dom";
import { previsualizarImportacion, aplicarImportacion } from "./actions";
import type { EstadoImportacion } from "./actions";

function BotonPrevisualizar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary self-start">
      {pending ? "Leyendo archivo…" : "Previsualizar"}
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
        if (!confirm(`¿Aplicar esta carga? Se van a crear/actualizar ${cantidad} insumo(s).`)) {
          e.preventDefault();
        }
      }}
    >
      {pending ? "Aplicando…" : `Confirmar y aplicar (${cantidad})`}
    </button>
  );
}

const estadoInicial: EstadoImportacion = { error: null, plan: null };

export default function ImportarCostosForm({ sedeId }: { sedeId: string }) {
  const [estado, formAction] = useFormState(previsualizarImportacion, estadoInicial);

  const plan = estado.plan;
  const itemsAAplicar = plan ? plan.items.filter((i) => i.accion !== "sin_cambio") : [];

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="card flex max-w-xl flex-col gap-4 p-5">
        <input type="hidden" name="sede_id" value={sedeId} />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Archivo (.xlsx)</label>
          <input
            type="file"
            name="archivo"
            accept=".xlsx"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
          />
        </div>

        {estado.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {estado.error}
          </p>
        )}

        <BotonPrevisualizar />
      </form>

      {plan && (
        <div className="card flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Vista previa</h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {plan.totalFilasArchivo} filas en el archivo — {plan.filasSubrecetaIgnoradas} son
              subrecetas (no se tocan), {plan.resumen.sinCambio} ya tienen el mismo costo,{" "}
              <strong>{plan.resumen.aActualizar}</strong> van a actualizar su costo y{" "}
              <strong>{plan.resumen.aCrear}</strong> se van a crear como insumos nuevos.
            </p>
          </div>

          {itemsAAplicar.length > 0 && (
            <div className="erp-scroll max-h-96">
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
                  {itemsAAplicar.map((item, indice) => (
                    <tr key={`${item.articulo}-${indice}`}>
                      <td className="font-medium">{item.articulo}</td>
                      <td style={{ color: "var(--muted)" }}>
                        {item.accion === "crear" ? "Insumo nuevo" : "Actualizar costo"}
                      </td>
                      <td className="text-right fin-value">
                        {item.costeAnterior !== null
                          ? item.costeAnterior.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : "—"}
                      </td>
                      <td className="text-right fin-value">
                        {item.costeArchivo.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form action={aplicarImportacion} className="flex flex-col gap-2">
            <input type="hidden" name="sede_id" value={sedeId} />
            <input type="hidden" name="items_json" value={JSON.stringify(itemsAAplicar)} />
            <BotonAplicar cantidad={itemsAAplicar.length} />
          </form>
        </div>
      )}
    </div>
  );
}
