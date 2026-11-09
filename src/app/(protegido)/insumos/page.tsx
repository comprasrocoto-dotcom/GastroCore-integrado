import Link from "next/link";
import { getUsuarioActual, tieneModulo } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import { listarInsumos, obtenerUltimasVariaciones } from "@/lib/data/insumos";
import { obtenerConfiguracionCosteo } from "@/lib/data/configuracion";
import { eliminarInsumo } from "./actions";
import InsumosTabla, { type FilaInsumoVista } from "./InsumosTabla";

export default async function InsumosPage({
  searchParams,
}: {
  searchParams: { sede?: string; q?: string; pagina?: string; error?: string; enviado?: string; creados?: string };
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

  const pagina = Number(searchParams.pagina ?? "1") || 1;
  const [{ insumos, total, totalPaginas }, config, variaciones] = await Promise.all([
    listarInsumos(sedeActiva.id, { q: searchParams.q, pagina }),
    obtenerConfiguracionCosteo(sedeActiva.id),
    obtenerUltimasVariaciones(sedeActiva.id),
  ]);

  const umbralAlerta = config.alertaInsumoPct !== null ? config.alertaInsumoPct * 100 : null;

  const qParam = searchParams.q ? `&q=${encodeURIComponent(searchParams.q)}` : "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">{sedeActiva.marca_nombre} / {sedeActiva.nombre}</p>
          <h1 className="text-xl font-semibold">Insumos</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{total} insumos</p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            &quot;Eliminar&quot; borra el insumo de verdad y no se puede deshacer — solo funciona si no
            está usado en ninguna receta ni subreceta. Si lo está, desactivalo (campo &quot;Activo&quot;,
            al editarlo) en vez de eliminarlo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/insumos/importar?sede=${sedeActiva.id}`} className="btn-secondary">
            Cargar costos desde archivo
          </Link>
          <Link href={`/insumos/nuevo?sede=${sedeActiva.id}`} className="btn-primary">
            + Nuevo insumo
          </Link>
        </div>
      </div>

      {searchParams.error && (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "#fca5a5", background: "#fef2f2", color: "#b91c1c" }}
        >
          {searchParams.error}
        </div>
      )}

      {searchParams.enviado === "1" && (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "#86efac", background: "#f0fdf4", color: "#166534" }}
        >
          Listo: se creó {searchParams.creados ?? 0} insumo(s) nuevo(s) en la sede destino.
        </div>
      )}

      <form className="flex gap-2">
        <input type="hidden" name="sede" value={sedeActiva.id} />
        <input
          type="search"
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Buscar por artículo, subartículo o referencia…"
          className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
        />
        <button type="submit" className="btn-secondary">
          Buscar
        </button>
      </form>

      <InsumosTabla
        insumos={insumos.map((i): FilaInsumoVista => {
          const variacion = variaciones[i.id];
          const alerta =
            umbralAlerta !== null &&
            typeof variacion === "number" &&
            Math.abs(variacion) >= umbralAlerta;
          return { ...i, alerta, variacionPct: typeof variacion === "number" ? variacion : null };
        })}
        sedeActivaId={sedeActiva.id}
        eliminarInsumo={eliminarInsumo}
      />

      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {pagina > 1 && (
            <Link
              href={`/insumos?sede=${sedeActiva.id}&pagina=${pagina - 1}${qParam}`}
              className="btn-secondary"
            >
              ← Anterior
            </Link>
          )}
          <span style={{ color: "var(--muted)" }}>
            Página {pagina} de {totalPaginas}
          </span>
          {pagina < totalPaginas && (
            <Link
              href={`/insumos?sede=${sedeActiva.id}&pagina=${pagina + 1}${qParam}`}
              className="btn-secondary"
            >
              Siguiente →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
