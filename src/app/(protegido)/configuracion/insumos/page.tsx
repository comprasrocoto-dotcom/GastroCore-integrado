import { getUsuarioActual, esMaestro } from "@/lib/auth/usuario-actual";
import { listarMarcasConSedes } from "@/lib/data/marcas";
import { contarInsumosActivosMarca } from "@/lib/data/reemplazar-insumos";
import ReemplazarInsumosForm, { type MarcaConSedesYConteo } from "./ReemplazarInsumosForm";

/**
 * "Reemplazar / borrar insumos por marca" (12/11, pedido de Mariluz:
 * poder cargar un archivo nuevo que reemplace la base de insumos de una
 * marca entera, o directamente vaciarla, sin tener que pedírmelo cada
 * vez). Reservada al Admin multi-marca, igual que Marcas y sedes —
 * afecta de una sola vez a todas las sedes de una marca (ver el caso
 * real de 123 WOK documentado en `marcas/actions.ts`).
 *
 * "Reemplazar" actualiza TODO lo que traiga el archivo (costo, unidad,
 * subfamilia, subartículo, referencia) para los insumos que coincidan
 * por nombre, crea los que son nuevos, y no toca los que el archivo no
 * menciona. "Borrar" en realidad los desactiva — no se puede borrar de
 * verdad un insumo que esté usado en alguna receta o subreceta, así que
 * desactivar (ocultar sin romper nada) es la única forma segura de
 * "vaciar" la lista. Ver `lib/data/reemplazar-insumos.ts` para el
 * detalle completo de las reglas.
 */
export default async function ReemplazarInsumosPage({
  searchParams,
}: {
  searchParams: {
    marca?: string;
    error?: string;
    aplicado?: string;
    actualizados?: string;
    creados?: string;
    borrados?: string;
  };
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

  const marcasCrudo = await listarMarcasConSedes();
  const marcasActivas = marcasCrudo
    .filter((m) => m.activo)
    .map((m) => ({ ...m, sedes: m.sedes.filter((s) => s.activo) }))
    .filter((m) => m.sedes.length > 0);

  const marcas: MarcaConSedesYConteo[] = await Promise.all(
    marcasActivas.map(async (m) => ({
      ...m,
      cantidadInsumosActivos: await contarInsumosActivosMarca(m.sedes.map((s) => s.id)),
    }))
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="eyebrow">Configuración — Admin multi-marca</p>
        <h1 className="text-xl font-semibold">Reemplazar / borrar insumos por marca</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Subí un archivo (.xlsx) por cada sede de la marca — mismo formato de siempre (Cód.
          Barras, Artículo, Subartículo, Subfamilia, Coste). Los insumos que coincidan por nombre
          con uno que ya existe actualizan TODO lo que traiga el archivo; los que no existan
          todavía se crean nuevos; los que el archivo no menciona no se tocan. Las filas de
          subrecetas (código &quot;SUB...&quot;) nunca se tocan: su costo se calcula solo.
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
          Listo: se actualizaron {searchParams.actualizados ?? 0} insumo(s) y se crearon{" "}
          {searchParams.creados ?? 0} insumo(s) nuevo(s) en total. Las recetas y subrecetas de las
          sedes afectadas ya quedaron recalculadas.
        </div>
      )}

      {searchParams.borrados !== undefined && (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "#86efac", background: "#f0fdf4", color: "#166534" }}
        >
          Listo: se desactivaron {searchParams.borrados} insumo(s). Las recetas que los usaban
          siguen funcionando igual; los insumos desactivados ya no aparecen para elegir en recetas
          nuevas.
        </div>
      )}

      {marcas.length === 0 ? (
        <p className="text-sm text-slate-400">
          No hay ninguna marca activa con sedes activas todavía.
        </p>
      ) : (
        <ReemplazarInsumosForm marcas={marcas} marcaPreseleccionada={searchParams.marca ?? null} />
      )}
    </div>
  );
}
