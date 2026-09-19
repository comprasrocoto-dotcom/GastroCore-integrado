import Link from "next/link";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import { listarInsumos } from "@/lib/data/insumos";

export default async function InsumosPage({
  searchParams,
}: {
  searchParams: { sede?: string; q?: string; pagina?: string };
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  const sedesVisibles = await getSedesVisibles();
  const sedeActiva = resolverSedeActiva(usuario, sedesVisibles, searchParams.sede);

  if (!sedeActiva) {
    return <p style={{ color: "var(--muted)" }}>No hay ninguna sede disponible.</p>;
  }

  const pagina = Number(searchParams.pagina ?? "1") || 1;
  const { insumos, total, totalPaginas } = await listarInsumos(sedeActiva.id, {
    q: searchParams.q,
    pagina,
  });

  const qParam = searchParams.q ? `&q=${encodeURIComponent(searchParams.q)}` : "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">{sedeActiva.marca_nombre} / {sedeActiva.nombre}</p>
          <h1 className="text-xl font-semibold">Insumos</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{total} insumos</p>
        </div>
        <Link href={`/insumos/nuevo?sede=${sedeActiva.id}`} className="btn-primary">
          + Nuevo insumo
        </Link>
      </div>

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

      <div className="card overflow-hidden">
        <div className="erp-scroll">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Artículo</th>
                <th>Subartículo</th>
                <th>Familia / Subfamilia</th>
                <th>Unidad</th>
                <th className="text-right">Costo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {insumos.map((i) => (
                <tr key={i.id}>
                  <td className="font-medium">{i.articulo}</td>
                  <td style={{ color: "var(--muted)" }}>{i.subarticulo ?? "—"}</td>
                  <td style={{ color: "var(--muted)" }}>
                    {i.familia_nombre ? `${i.familia_nombre} / ${i.subfamilia_nombre}` : "—"}
                  </td>
                  <td style={{ color: "var(--muted)" }}>{i.unidad_codigo ?? "—"}</td>
                  <td className="text-right fin-value">
                    {i.coste.toLocaleString("es-CO", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="text-right">
                    <Link href={`/insumos/${i.id}?sede=${sedeActiva.id}`} className="text-sm font-medium text-[#2563EB] hover:underline">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
              {insumos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    No se encontraron insumos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
