import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import { listarFamiliasConSubfamilias } from "@/lib/data/familias";
import {
  crearFamilia,
  actualizarFamilia,
  crearSubfamilia,
  actualizarSubfamilia,
} from "./actions";

const inputClase =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#1E3A5F]";

export default async function FamiliasPage({
  searchParams,
}: {
  searchParams: { sede?: string };
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  const sedesVisibles = await getSedesVisibles();
  const sedeActiva = resolverSedeActiva(usuario, sedesVisibles, searchParams.sede);

  if (!sedeActiva) {
    return <p style={{ color: "var(--muted)" }}>No hay ninguna sede disponible.</p>;
  }

  const familias = await listarFamiliasConSubfamilias(sedeActiva.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow">{sedeActiva.marca_nombre} / {sedeActiva.nombre}</p>
        <h1 className="text-xl font-semibold">Familias y subfamilias</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{familias.length} familias</p>
      </div>

      <form action={crearFamilia} className="card flex flex-wrap items-end gap-2 p-3">
        <input type="hidden" name="sede_id" value={sedeActiva.id} />
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--muted)" }}>Nueva familia</label>
          <input name="nombre" required placeholder="Nombre" className={inputClase} />
        </div>
        <input name="tipo" placeholder="Tipo (opcional)" className={inputClase} />
        <input name="centrocosto" placeholder="Centro de costo (opcional)" className={inputClase} />
        <button type="submit" className="btn-primary">
          Agregar
        </button>
      </form>

      <div className="flex flex-col gap-4">
        {familias.map((f) => (
          <details key={f.id} className="card p-3" open>
            <summary className="cursor-pointer font-medium">
              {f.nombre}{" "}
              <span className="text-sm font-normal text-slate-400">
                ({f.subfamilias.length} subfamilias)
              </span>
            </summary>

            <form
              action={actualizarFamilia}
              className="mt-3 flex flex-wrap items-end gap-2 border-b pb-3"
              style={{ borderColor: "var(--line)" }}
            >
              <input type="hidden" name="id" value={f.id} />
              <input name="nombre" defaultValue={f.nombre} className={inputClase} />
              <input name="tipo" defaultValue={f.tipo ?? ""} placeholder="Tipo" className={inputClase} />
              <input
                name="centrocosto"
                defaultValue={f.centrocosto ?? ""}
                placeholder="Centro de costo"
                className={inputClase}
              />
              <label className="flex items-center gap-1 text-sm text-slate-600">
                <input type="checkbox" name="activo" defaultChecked={f.activo} />
                Activa
              </label>
              <button type="submit" className="btn-secondary">
                Guardar
              </button>
            </form>

            <div className="mt-3 erp-scroll">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Subfamilia</th>
                    <th>Tipo</th>
                    <th>Centro de costo</th>
                    <th>Activa</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {f.subfamilias.map((s) => (
                    <tr key={s.id}>
                      <td colSpan={5}>
                        <form
                          action={actualizarSubfamilia}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input type="hidden" name="id" value={s.id} />
                          <input name="nombre" defaultValue={s.nombre} className={inputClase} />
                          <input
                            name="tipo"
                            defaultValue={s.tipo ?? ""}
                            placeholder="Tipo"
                            className={`w-28 ${inputClase}`}
                          />
                          <input
                            name="centrocosto"
                            defaultValue={s.centrocosto ?? ""}
                            placeholder="Centro de costo"
                            className={`w-40 ${inputClase}`}
                          />
                          <label className="flex items-center gap-1 text-sm text-slate-600">
                            <input
                              type="checkbox"
                              name="activo"
                              defaultChecked={s.activo}
                            />
                            Activa
                          </label>
                          <button type="submit" className="btn-secondary">
                            Guardar
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form
              action={crearSubfamilia}
              className="mt-3 flex flex-wrap items-end gap-2"
            >
              <input type="hidden" name="sede_id" value={sedeActiva.id} />
              <input type="hidden" name="familia_id" value={f.id} />
              <input name="nombre" required placeholder="Nueva subfamilia" className={inputClase} />
              <input name="tipo" placeholder="Tipo" className={`w-28 ${inputClase}`} />
              <input name="centrocosto" placeholder="Centro de costo" className={`w-40 ${inputClase}`} />
              <button type="submit" className="btn-secondary">
                Agregar subfamilia
              </button>
            </form>
          </details>
        ))}
      </div>
    </div>
  );
}
