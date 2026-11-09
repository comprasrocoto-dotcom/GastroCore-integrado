"use client";

/**
 * Tabla de Insumos con checkboxes de selección (09/11, pedido de
 * Mariluz: poder "amarrar" — en realidad copiar — artículos ya creados
 * en una sede hacia otra marca). Antes esto era una tabla simple dentro
 * de page.tsx; se separó a un componente cliente solo para poder tener
 * estado de selección y la barra de "Enviar a otra marca" que aparece
 * cuando hay algo marcado. El resto del comportamiento (editar, eliminar)
 * es exactamente el mismo de antes.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InsumoFila } from "@/lib/data/insumos";
import BotonEliminarInsumo from "./BotonEliminarInsumo";

export type FilaInsumoVista = InsumoFila & { alerta: boolean; variacionPct: number | null };

export default function InsumosTabla({
  insumos,
  sedeActivaId,
  eliminarInsumo,
}: {
  insumos: FilaInsumoVista[];
  sedeActivaId: string;
  eliminarInsumo: (formData: FormData) => void;
}) {
  const router = useRouter();
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  function alternar(id: string) {
    setSeleccionados((anterior) => {
      const copia = new Set(anterior);
      if (copia.has(id)) copia.delete(id);
      else copia.add(id);
      return copia;
    });
  }

  function enviarSeleccionados() {
    const ids = Array.from(seleccionados).join(",");
    router.push(`/insumos/enviar?origen=${sedeActivaId}&ids=${ids}`);
  }

  return (
    <div className="flex flex-col gap-3">
      {seleccionados.size > 0 && (
        <div
          className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "#bfdbfe", background: "#eff6ff", color: "#1e3a5f" }}
        >
          <span>{seleccionados.size} insumo(s) seleccionado(s)</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-sm font-medium text-[#2563EB] hover:underline"
              onClick={() => setSeleccionados(new Set())}
            >
              Quitar selección
            </button>
            <button type="button" className="btn-primary" onClick={enviarSeleccionados}>
              Enviar a otra marca
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="erp-scroll">
          <table className="erp-table">
            <thead>
              <tr>
                <th></th>
                <th>Artículo</th>
                <th>Subartículo</th>
                <th>Familia / Subfamilia</th>
                <th>Unidad</th>
                <th className="text-right">Costo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {insumos.map((i) => (
                <tr key={i.id} style={i.alerta ? { background: "#fef2f2" } : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      checked={seleccionados.has(i.id)}
                      onChange={() => alternar(i.id)}
                      aria-label={`Seleccionar ${i.articulo}`}
                    />
                  </td>
                  <td className="font-medium">
                    {i.alerta && i.variacionPct !== null && (
                      <span
                        title={`Subió ${i.variacionPct.toFixed(1)}% en el último cambio de precio`}
                        className="mr-1"
                      >
                        🔴
                      </span>
                    )}
                    {i.articulo}
                  </td>
                  <td style={{ color: "var(--muted)" }}>{i.subarticulo ?? "—"}</td>
                  <td style={{ color: "var(--muted)" }}>
                    {i.familia_nombre ? `${i.familia_nombre} / ${i.subfamilia_nombre}` : "—"}
                  </td>
                  <td style={{ color: "var(--muted)" }}>{i.unidad_codigo ?? "—"}</td>
                  <td className="text-right fin-value">
                    {i.coste.toLocaleString("es-CO", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/insumos/${i.id}?sede=${sedeActivaId}`}
                        className="text-sm font-medium text-[#2563EB] hover:underline"
                      >
                        Editar
                      </Link>
                      <form action={eliminarInsumo}>
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="nombre" value={i.articulo} />
                        <input type="hidden" name="sede_id" value={sedeActivaId} />
                        <BotonEliminarInsumo etiqueta={i.articulo} />
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {insumos.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                    No se encontraron insumos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
