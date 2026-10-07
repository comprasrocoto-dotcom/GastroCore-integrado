import { cookies } from "next/headers";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import { listarRecetario } from "@/lib/data/recetario";
import { obtenerClavesRecetario } from "@/lib/data/configuracion";
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

  const sedesVisibles = await getSedesVisibles();
  const sedeActiva = resolverSedeActiva(usuario, sedesVisibles, searchParams.sede);
  if (!sedeActiva) return <p style={{ color: "var(--muted)" }}>No hay ninguna sede disponible.</p>;

  // El candado de Bar/Cocina solo aplica si la sede tiene alguna clave
  // cargada en Configuración, y no aplica para Admin (ya ve todo con su
  // propio usuario). Mientras nadie cargue una clave, el Recetario se ve
  // exactamente como siempre.
  const claves = await obtenerClavesRecetario(sedeActiva.id);
  const candadoActivo = (claves.bar || claves.cocina) && usuario.rol !== "Admin";

  let area: "BAR" | "COCINA" | null = null;
  if (candadoActivo) {
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
      <div>
        <p className="eyebrow">{sedeActiva.marca_nombre} / {sedeActiva.nombre}</p>
        <h1 className="text-xl font-semibold">Recetario</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Solo preparación y emplatado — sin costos ni precios.
          {area && ` Viendo: ${area === "BAR" ? "Bar" : "Cocina"}.`}
        </p>
      </div>

      <RecetarioExplorador items={items} />
    </div>
  );
}
