import { getUsuarioActual, esMaestro } from "@/lib/auth/usuario-actual";
import { listarMarcasConSedes } from "@/lib/data/marcas";
import { crearMarca, actualizarMarca, crearSede, actualizarSede } from "./actions";

const inputClase =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#1E3A5F]";

/**
 * Marcas y sedes — para dar de alta una marca nueva o una sede nueva
 * (ej. "San Agustín" dentro de 123 WOK) y para desactivar las que ya no
 * se usan. "Desactivar" nunca borra nada de verdad: los insumos, recetas
 * y demás datos que ya tenga esa marca/sede quedan guardados en la base,
 * por si hace falta reactivarla — mismo patrón que ya usan Familias e
 * Insumos con su propio campo "Activa". Reservada al Admin multi-marca.
 */
export default async function MarcasPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  if (!esMaestro(usuario)) {
    return (
      <p style={{ color: "var(--muted)" }}>
        Esta pantalla es solo para el Admin multi-marca.
      </p>
    );
  }

  const marcas = await listarMarcasConSedes();
  const totalSedes = marcas.reduce((s, m) => s + m.sedes.length, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Marcas y sedes</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          {marcas.length} marcas · {totalSedes} sedes en total
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Desactivar una marca o sede no borra nada: solo la saca de los selectores de todos
          los días. Los insumos, recetas y demás datos que ya tenga quedan guardados, por si
          hay que reactivarla más adelante.
        </p>
      </div>

      <form action={crearMarca} className="card flex flex-wrap items-end gap-2 p-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--muted)" }}>
            Nueva marca
          </label>
          <input name="nombre" required placeholder="Nombre de la marca" className={inputClase} />
        </div>
        <button type="submit" className="btn-primary">
          Agregar marca
        </button>
      </form>

      <div className="flex flex-col gap-4">
        {marcas.map((m) => (
          <details key={m.id} className="card p-3" open>
            <summary className="cursor-pointer font-medium">
              {m.nombre}{" "}
              <span className="text-sm font-normal text-slate-400">
                ({m.sedes.length} sedes{m.activo ? "" : " · inactiva"})
              </span>
            </summary>

            <form
              action={actualizarMarca}
              className="mt-3 flex flex-wrap items-end gap-2 border-b pb-3"
              style={{ borderColor: "var(--line)" }}
            >
              <input type="hidden" name="id" value={m.id} />
              <input name="nombre" defaultValue={m.nombre} className={inputClase} />
              <label className="flex items-center gap-1 text-sm text-slate-600">
                <input type="checkbox" name="activo" defaultChecked={m.activo} />
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
                    <th>Sede</th>
                    <th>Activa</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {m.sedes.map((s) => (
                    <tr key={s.id}>
                      <td colSpan={3}>
                        <form action={actualizarSede} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={s.id} />
                          <input name="nombre" defaultValue={s.nombre} className={inputClase} />
                          <label className="flex items-center gap-1 text-sm text-slate-600">
                            <input type="checkbox" name="activo" defaultChecked={s.activo} />
                            Activa
                          </label>
                          <button type="submit" className="btn-secondary">
                            Guardar
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {m.sedes.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-sm text-slate-400">
                        Todavía no tiene ninguna sede.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <form action={crearSede} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="marca_id" value={m.id} />
              <input name="nombre" required placeholder="Nueva sede" className={inputClase} />
              <button type="submit" className="btn-secondary">
                Agregar sede
              </button>
            </form>
          </details>
        ))}
      </div>
    </div>
  );
}
