import { getUsuarioActual, tieneModulo } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import ImportarCostosForm from "./ImportarCostosForm";

export default async function ImportarCostosPage({
  searchParams,
}: {
  searchParams: {
    sede?: string;
    error?: string;
    aplicado?: string;
    actualizados?: string;
    creados?: string;
  };
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  if (!tieneModulo(usuario, "insumos")) {
    return (
      <p style={{ color: "var(--muted)" }}>
        No tenés permiso para ver esta pantalla.
      </p>
    );
  }

  const sedesVisibles = await getSedesVisibles();
  const sedeActiva = resolverSedeActiva(usuario, sedesVisibles, searchParams.sede);

  if (!sedeActiva) {
    return <p style={{ color: "var(--muted)" }}>No hay ninguna sede disponible.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="eyebrow">
          {sedeActiva.marca_nombre} / {sedeActiva.nombre}
        </p>
        <h1 className="text-xl font-semibold">Cargar costos desde archivo</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Subí un Excel con las columnas Cód. Barras, Artículo, Subartículo
          (en realidad la unidad), Subfamilia y Coste — el mismo formato que
          ya se viene usando. Los insumos que coincidan por nombre con uno
          que ya existe en esta sede actualizan su costo; los que no existan
          todavía se crean nuevos. Las filas de subrecetas (código que
          arranca con &quot;SUB&quot;) no se tocan: su costo se sigue
          calculando solo, a partir de sus ingredientes, no se puede pisar
          desde un archivo.
        </p>
      </div>

      {searchParams.error && (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "#fca5a5", background: "#fef2f2", color: "#b91c1c" }}
        >
          {searchParams.error}
        </div>
      )}

      {searchParams.aplicado === "1" && (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "#86efac", background: "#f0fdf4", color: "#166534" }}
        >
          Listo: se actualizó el costo de {searchParams.actualizados ?? 0} insumo(s) y
          se creó {searchParams.creados ?? 0} insumo(s) nuevo(s). Las recetas y
          subrecetas de esta sede ya quedaron recalculadas con los costos nuevos.
        </div>
      )}

      <ImportarCostosForm sedeId={sedeActiva.id} />
    </div>
  );
}
