import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import HeaderProtegido from "@/components/HeaderProtegido";

/**
 * Un Layout de Next.js (a diferencia de una Page) no puede recibir
 * `searchParams` como prop — por eso este layout ya no lo declara. La
 * parte que necesitaba saber la sede activa desde la URL (el header y su
 * navegación) se movió a `HeaderProtegido`, un componente de cliente que
 * lee el query param `sede` con `useSearchParams()`. Acá solo se resuelve
 * una sede "por defecto" (sin mirar la URL) para el primer render.
 */
export default async function LayoutProtegido({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioActual();

  if (!usuario) {
    redirect("/login");
  }

  const sedesVisibles = await getSedesVisibles();
  const sedePorDefecto = resolverSedeActiva(usuario, sedesVisibles, undefined);

  return (
    <div className="min-h-screen">
      <HeaderProtegido
        usuarioNombre={usuario.nombre}
        usuarioRol={usuario.rol}
        sedesVisibles={sedesVisibles}
        sedeIdPorDefecto={sedePorDefecto?.id ?? null}
      />

      <main className="app-shell py-8">{children}</main>
    </div>
  );
}
