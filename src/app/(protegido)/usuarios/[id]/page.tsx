import Link from "next/link";
import { notFound } from "next/navigation";
import { getUsuarioActual, esMaestro } from "@/lib/auth/usuario-actual";
import { listarMarcasConSedes } from "@/lib/data/marcas";
import { listarRoles } from "@/lib/data/roles";
import { obtenerUsuarioParaEditar } from "../actions";
import EditarUsuarioForm from "../EditarUsuarioForm";

/**
 * Editar un usuario que ya existe (rol, sedes, módulos permitidos, área)
 * — reservada al Admin multi-marca, igual que el resto de "Usuarios". No
 * se puede cambiar nombre, correo ni contraseña desde acá, ver
 * `EditarUsuarioForm`.
 */
export default async function EditarUsuarioPage({
  params,
}: {
  params: { id: string };
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  if (!esMaestro(usuario)) {
    return (
      <p style={{ color: "var(--muted)" }}>
        Esta pantalla es solo para el Admin multi-marca.
      </p>
    );
  }

  const [usuarioEditar, marcas, roles] = await Promise.all([
    obtenerUsuarioParaEditar(params.id),
    listarMarcasConSedes(),
    listarRoles(),
  ]);

  if (!usuarioEditar) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow">
          <Link href="/usuarios" className="hover:underline">
            Usuarios
          </Link>{" "}
          / {usuarioEditar.nombre}
        </p>
        <h1 className="text-xl font-semibold">Editar usuario</h1>
      </div>

      <EditarUsuarioForm usuario={usuarioEditar} marcas={marcas} roles={roles} />
    </div>
  );
}
