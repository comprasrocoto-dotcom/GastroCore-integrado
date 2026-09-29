"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  calcularResumenCosteo,
  precioSugeridoPanel,
  utilidad,
  type Semaforo,
} from "@/lib/costeo";

const COLOR_DOT: Record<Semaforo, string> = {
  verde: "bg-emerald-500",
  amarillo: "bg-amber-400",
  rojo: "bg-red-500",
};

const money = (n: number) => "$" + (n || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });

export type FilaDetalle = {
  id: string;
  nombre: string;
  sedeId: string;
  familiaNombre: string;
  costoPorcion: number;
  precioReal: number | null;
  iva: number;
  activo: boolean;
};

export default function PanelDetalleTabla({
  filas,
  fcObjetivo,
  fcObjetivoPanel,
  actualizar,
}: {
  filas: FilaDetalle[];
  fcObjetivo: number;
  fcObjetivoPanel: number;
  actualizar: (
    recetaId: string,
    sedeId: string,
    precioReal: number,
    activo: boolean
  ) => Promise<void>;
}) {
  return (
    <div className="erp-scroll">
      <table className="erp-table recetas-table">
        <thead>
          <tr>
            <th>Receta</th>
            <th>Familia</th>
            <th className="text-right">Costo plato</th>
            <th className="text-right">Precio actual</th>
            <th className="text-right">Food Cost actual</th>
            <th className="text-right">Precio sugerido editable</th>
            <th className="text-right">Food Cost resultante</th>
            <th className="text-right">Utilidad</th>
            <th>Estado</th>
            <th>Accion</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <FilaEditable
              key={f.id}
              fila={f}
              fcObjetivo={fcObjetivo}
              fcObjetivoPanel={fcObjetivoPanel}
              actualizar={actualizar}
            />
          ))}
          {filas.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-6 text-center text-slate-400">
                No hay recetas para el filtro seleccionado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function FilaEditable({
  fila,
  fcObjetivo,
  fcObjetivoPanel,
  actualizar,
}: {
  fila: FilaDetalle;
  fcObjetivo: number;
  fcObjetivoPanel: number;
  actualizar: (
    recetaId: string,
    sedeId: string,
    precioReal: number,
    activo: boolean
  ) => Promise<void>;
}) {
  const resumen = fila.precioReal
    ? calcularResumenCosteo(fila.costoPorcion, fila.precioReal, {
        fcObjetivo,
        fcObjetivoPanel,
        iva: fila.iva,
      })
    : null;

  const [precioInput, setPrecioInput] = useState(
    Math.round(precioSugeridoPanel(fila.costoPorcion, fcObjetivoPanel, fila.iva))
  );
  const [estadoInput, setEstadoInput] = useState(fila.activo ? "activo" : "inactivo");
  const [pending, startTransition] = useTransition();
  const [guardado, setGuardado] = useState(false);

  const utilidadSugerida = utilidad(precioInput, fila.costoPorcion);
  const deltaVsActual = fila.precioReal ? precioInput - fila.precioReal : precioInput;

  return (
    <tr>
      <td className="font-medium">
        <Link href={`/recetas/${fila.id}?sede=${fila.sedeId}`} className="text-[#2563EB] hover:underline">
          {fila.nombre}
        </Link>
      </td>
      <td>{fila.familiaNombre}</td>
      <td className="text-right fin-value">{money(fila.costoPorcion)}</td>
      <td className="text-right fin-value">{fila.precioReal ? money(fila.precioReal) : "—"}</td>
      <td className="text-right">
        {resumen ? (
          <span className="inline-flex items-center justify-end gap-1.5">
            <span className={`h-2 w-2 rounded-full ${COLOR_DOT[resumen.semaforo]}`} />
            <span className="font-semibold">{(resumen.foodCost * 100).toFixed(1)}%</span>
            <span style={{ color: "var(--muted)" }}>{deltaVsActual >= 0 ? "↑" : "↓"}</span>
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="text-right">
        <input
          type="number"
          step="1"
          value={precioInput}
          onChange={(e) => {
            setGuardado(false);
            setPrecioInput(Number(e.target.value) || 0);
          }}
          className="w-28 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-right text-sm outline-none focus:border-[#1E3A5F]"
        />
        <p className={`mt-0.5 text-[11px] font-medium ${deltaVsActual >= 0 ? "text-emerald-600" : "text-red-500"}`}>
          {deltaVsActual >= 0 ? "+" : "−"}
          {money(Math.abs(deltaVsActual))}
        </p>
      </td>
      <td className="text-right">
        <span className="inline-flex items-center justify-end gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-semibold">{(fcObjetivoPanel * 100).toFixed(1)}%</span>
        </span>
      </td>
      <td className="text-right fin-value">{money(utilidadSugerida)}</td>
      <td>
        <select
          value={estadoInput}
          onChange={(e) => {
            setGuardado(false);
            setEstadoInput(e.target.value);
          }}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#1E3A5F]"
        >
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </select>
      </td>
      <td>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await actualizar(fila.id, fila.sedeId, precioInput, estadoInput === "activo");
              setGuardado(true);
            })
          }
          className="btn-secondary whitespace-nowrap"
        >
          {pending ? "Guardando..." : guardado ? "✓ Actualizado" : "Actualizar precio"}
        </button>
      </td>
    </tr>
  );
}
