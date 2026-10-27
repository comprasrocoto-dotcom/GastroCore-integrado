import Link from "next/link";
import { notFound } from "next/navigation";
import { getUsuarioActual, esMaestro } from "@/lib/auth/usuario-actual";
import { listarMarcasConSedes } from "@/lib/data/marcas";
import { obtenerUsuarioParaEditar } from "../actions";
import EditarUsuarioForm from "../EditarUsuarioForm";

/**
 * Editar un usuario que ya existe (sedes, módulos permitidos, área) —
 * reservada al Admin multi-marca, igual que el resto de "Usuarios". No
 * se puede cambiar nombre, correo, contraseña ni rol desde acá, ver
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

  const [usuarioEditar, marcas] = await Promise.all([
    obtenerUsuarioParaEditar(params.id),
    listarMarcasConSedes(),
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

      <EditarUsuarioForm usuario={usuarioEditar} marcas={marcas} />
    </div>
  );
}
