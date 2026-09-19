import { notFound } from "next/navigation";
import {
  obtenerInsumo,
  listarSubfamilias,
  listarUnidades,
  listarHistorialPrecios,
} from "@/lib/data/insumos";
import InsumoForm from "../InsumoForm";
import { actualizarInsumo } from "../actions";

export default async function EditarInsumoPage({
  params,
}: {
  params: { id: string };
}) {
  const insumo = await obtenerInsumo(params.id);
  if (!insumo) notFound();

  const [subfamilias, unidades, historial] = await Promise.all([
    listarSubfamilias(insumo.sede_id),
    listarUnidades(),
    listarHistorialPrecios(insumo.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="eyebrow">Editar insumo</p>
        <h1 className="text-xl font-semibold">{insumo.articulo}</h1>
      </div>

      <InsumoForm
        accion={actualizarInsumo}
        valoresIniciales={insumo}
        subfamilias={subfamilias.map((s) => ({
          id: s.id,
          etiqueta: `${s.familia_nombre} / ${s.nombre}`,
        }))}
        unidades={unidades.map((u) => ({ id: u.codigo, etiqueta: `${u.codigo} — ${u.nombre}` }))}
        sedeId={insumo.sede_id}
        esEdicion
      />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          Historial de precios
        </h2>
        {historial.length === 0 ? (
          <p className="text-sm text-slate-400">Todavía no hay cambios de precio registrados.</p>
        ) : (
          <div className="card overflow-hidden">
            <div className="erp-scroll">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th className="text-right">Costo anterior</th>
                    <th className="text-right">Costo nuevo</th>
                    <th>Motivo</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((h) => (
                    <tr key={h.id}>
                      <td>{new Date(h.fecha).toLocaleDateString("es-CO")}</td>
                      <td className="text-right fin-value">{h.coste_anterior ?? "—"}</td>
                      <td className="text-right fin-value">{h.coste}</td>
                      <td>{h.motivo ?? "—"}</td>
                      <td>{h.usuario_nombre ?? "—"}</td>
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
