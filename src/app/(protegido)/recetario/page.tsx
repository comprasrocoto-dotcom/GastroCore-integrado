import { cookies } from "next/headers";
import { getUsuarioActual, tieneModulo } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import { listarRecetario } from "@/lib/data/recetario";
import { obtenerClavesRecetario, obtenerIdentidad } from "@/lib/data/configuracion";
import { obtenerTema } from "@/lib/temas-recetario";
import RecetarioExplorador from "./RecetarioExplorador";
import RecetarioClaveGate from "./RecetarioClaveGate";
import { COOKIE_AREA_RECETARIO } from "./actions";

export const dynamic = "force-dynamic";

export default async function RecetarioPage({
  searchParams,
}: {
  searchParams: { sede?: string };
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  if (!tieneModulo(usuario, "recetario")) {
    return (
      <p style={{ color: "var(--muted)" }}>
        No tenés permiso para ver esta pantalla.
      </p>
    );
  }

  const sedesVisibles = await getSedesVisibles();
  const sedeActiva = resolverSedeActiva(usuario, sedesVisibles, searchParams.sede);
  if (!sedeActiva) return <p style={{ color: "var(--muted)" }}>No hay ninguna sede disponible.</p>;

  // El candado de Bar/Cocina solo aplica si la sede tiene alguna clave
  // cargada en Configuración, y no aplica para Admin (ya ve todo con su
  // propio usuario) ni para alguien que ya tiene un área personal
  // asignada (ver "Usuarios") — a esos dos no se les pide ninguna clave.
  // Mientras nadie cargue una clave, el Recetario se ve exactamente
  // como siempre.
  const claves = await obtenerClavesRecetario(sedeActiva.id);
  const candadoActivo = (claves.bar || claves.cocina) && !usuario.accesoTotal && !usuario.area;

  let area: "BAR" | "COCINA" | null = usuario.area ?? null;
  if (!area && candadoActivo) {
    const cookieArea = cookies().get(COOKIE_AREA_RECETARIO(sedeActiva.id))?.value;
    if (cookieArea === "BAR" || cookieArea === "COCINA") area = cookieArea;
  }

  if (candadoActivo && !area) {
    return (
      <RecetarioClaveGate
        sedeId={sedeActiva.id}
        tieneBar={Boolean(claves.bar)}
        tieneCocina={Boolean(claves.cocina)}
      />
    );
  }

  const temaId = await obtenerIdentidad(sedeActiva.id);
  const tema = obtenerTema(temaId);

  const itemsSinFiltrar = await listarRecetario(sedeActiva.id);
  const items = area
    ? itemsSinFiltrar.filter((i) => {
        const centro = (i.centrocosto ?? "").toUpperCase();
        // Sin área asignada en la familia ("Sin clasificar"/null) o
        // marcada "AMBAS": se ve desde las dos claves.
        return !centro || centro === "AMBAS" || centro === area;
      })
    : itemsSinFiltrar;

  return (
    <div className="flex flex-col gap-6">
      <RecetarioExplorador
        items={items}
        tema={tema}
        marcaNombre={`${sedeActiva.marca_nombre} · ${sedeActiva.nombre}`}
        area={area}
      />
    </div>
  );
}
