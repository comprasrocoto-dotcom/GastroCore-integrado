import Link from "next/link";
import { notFound } from "next/navigation";
import {
  obtenerInsumo,
  listarSubfamilias,
  listarUnidades,
  listarHistorialPrecios,
  listarUsosDeInsumo,
} from "@/lib/data/insumos";
import InsumoForm from "../InsumoForm";
import { actualizarInsumo } from "../actions";

const ETIQUETA_USO = { receta: "Receta", subreceta: "Subreceta", maestro_subreceta: "Es el maestro de" };
const RUTA_USO = { receta: "/recetas", subreceta: "/subrecetas", maestro_subreceta: "/subrecetas" };

export default async function EditarInsumoPage({
  params,
}: {
  params: { id: string };
}) {
  const insumo = await obtenerInsumo(params.id);
  if (!insumo) notFound();

  const [subfamilias, unidades, historial, usos] = await Promise.all([
    listarSubfamilias(insumo.sede_id),
    listarUnidades(),
    listarHistorialPrecios(insumo.id),
    listarUsosDeInsumo(insumo.id),
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

      <div id="donde-se-usa">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">¿Dónde se usa?</h2>
        {usos.length === 0 ? (
          <p className="text-sm text-slate-400">
            Este insumo todavía no está usado en ninguna receta ni subreceta.
          </p>
        ) : (
          <div className="card overflow-hidden">
            <div className="erp-scroll">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Nombre</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {usos.map((u) => (
                    <tr key={`${u.tipo}-${u.id}`}>
                      <td style={{ color: "var(--muted)" }}>{ETIQUETA_USO[u.tipo]}</td>
                      <td className="font-medium">{u.nombre}</td>
                      <td className="text-right">
                        <Link
                          href={`${RUTA_USO[u.tipo]}/${u.id}?sede=${insumo.sede_id}`}
                          className="text-sm font-medium text-[#2563EB] hover:underline"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

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
