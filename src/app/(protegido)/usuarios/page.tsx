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
  sede_nombre: string | null;
};

async function listarUsuarios(): Promise<FilaUsuario[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, email, nombre, rol, activo, marcas(nombre), sedes(nombre)")
    .order("nombre");

  if (error || !data) return [];

  return data.map((u) => ({
    id: u.id as string,
    email: u.email as string,
    nombre: u.nombre as string,
    rol: u.rol as string,
    activo: u.activo as boolean,
    marca_nombre: (u.marcas as unknown as { nombre: string } | null)?.nombre ?? null,
    sede_nombre: (u.sedes as unknown as { nombre: string } | null)?.nombre ?? null,
  }));
}

function alcanceTexto(u: FilaUsuario) {
  if (u.sede_nombre) return u.sede_nombre;
  if (u.marca_nombre) return `${u.marca_nombre} (toda la marca)`;
  return "Todas las marcas";
}

/**
 * Usuarios — crear cuentas nuevas (correo + contraseña + rol) y
 * activar/desactivar las que ya existen. Reservada al Admin multi-marca:
 * define quién puede entrar al sistema y qué puede ver cada quien.
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
