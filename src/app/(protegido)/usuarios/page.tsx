import { getUsuarioActual, esMaestro } from "@/lib/auth/usuario-actual";
import { createClient } from "@/lib/supabase/server";
import { listarMarcasConSedes } from "@/lib/data/marcas";
import { cambiarEstadoUsuario } from "./actions";
import CrearUsuarioForm from "./CrearUsuarioForm";

type FilaUsuario = {
  id: string;
  email: string;
  nombre: string;
  rol: string;
  activo: boolean;
  marca_nombre: string | null;
  sedes_nombres: string[];
};

async function listarUsuarios(): Promise<FilaUsuario[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, email, nombre, rol, activo, marcas(nombre), usuario_sedes(sedes(nombre))")
    .order("nombre");

  if (error || !data) return [];

  return data.map((u) => {
    const sedesAsignadas = (u.usuario_sedes as unknown as { sedes: { nombre: string } | null }[]) ?? [];
    return {
      id: u.id as string,
      email: u.email as string,
      nombre: u.nombre as string,
      rol: u.rol as string,
      activo: u.activo as boolean,
      marca_nombre: (u.marcas as unknown as { nombre: string } | null)?.nombre ?? null,
      sedes_nombres: sedesAsignadas
        .map((fila) => fila.sedes?.nombre)
        .filter((nombre): nombre is string => Boolean(nombre))
        .sort((a, b) => a.localeCompare(b)),
    };
  });
}

function alcanceTexto(u: FilaUsuario) {
  if (u.sedes_nombres.length > 0) return u.sedes_nombres.join(", ");
  if (u.marca_nombre) return `${u.marca_nombre} (toda la marca)`;
  return "Todas las marcas";
}

/**
 * Usuarios — crear cuentas nuevas (correo + contraseña + rol) y
 * activar/desactivar las que ya existen. Reservada al Admin multi-marca:
 * define quién puede entrar al sistema y qué puede ver cada quien.
 *
 * Desde el 26/10 un usuario puede tener una o varias sedes asignadas
 * (tabla usuario_sedes) en vez de una sola — ver docs/arquitectura.md,
 * sección "Sedes múltiples por usuario".
 *
 * Para crear la cuenta de verdad en Supabase Auth hace falta la
 * service_role key como variable de entorno en Vercel
 * (SUPABASE_SERVICE_ROLE_KEY) — ver lib/supabase/admin.ts. Mientras esa
 * variable no esté cargada, el botón "Crear usuario" va a mostrar un
 * error explicándolo en vez de fallar en silencio.
 */
export default async function UsuariosPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  if (!esMaestro(usuario)) {
    return (
      <p style={{ color: "var(--muted)" }}>
        Esta pantalla es solo para el Admin multi-marca.
      </p>
    );
  }

  const [usuarios, marcas] = await Promise.all([listarUsuarios(), listarMarcasConSedes()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Usuarios</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          {usuarios.length} usuarios
        </p>
      </div>

      <CrearUsuarioForm marcas={marcas} />

      <div className="erp-scroll">
        <table className="erp-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Alcance</th>
              <th>Activo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>{u.nombre}</td>
                <td>{u.email}</td>
                <td>{u.rol}</td>
                <td>{alcanceTexto(u)}</td>
                <td colSpan={2}>
                  <form action={cambiarEstadoUsuario} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={u.id} />
                    <label className="flex items-center gap-1 text-sm text-slate-600">
                      <input type="checkbox" name="activo" defaultChecked={u.activo} />
                      {u.activo ? "Activo" : "Desactivado"}
                    </label>
                    <button type="submit" className="btn-secondary">
                      Guardar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={6} className="text-sm text-slate-400">
                  Todavía no hay usuarios creados desde acá.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
