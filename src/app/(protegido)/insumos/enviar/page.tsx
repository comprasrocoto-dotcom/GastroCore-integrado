import Link from "next/link";
import { getUsuarioActual, tieneModulo } from "@/lib/auth/usuario-actual";
import { getSedesVisibles } from "@/lib/data/sedes";
import { obtenerArticulosPorIds } from "@/lib/data/enviar-insumos";
import EnviarInsumosForm from "./EnviarInsumosForm";

export default async function EnviarInsumosPage({
  searchParams,
}: {
  searchParams: { origen?: string; ids?: string; error?: string };
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

  const sedeOrigenId = searchParams.origen ?? "";
  const insumoIds = (searchParams.ids ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const sedesVisibles = await getSedesVisibles();
  const sedeOrigen = sedesVisibles.find((s) => s.id === sedeOrigenId);

  if (!sedeOrigen || insumoIds.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p style={{ color: "var(--muted)" }}>
          No hay insumos seleccionados para enviar. Volvé a Insumos, elegí los que querés
          mandar a otra marca con los checkboxes y probá de nuevo.
        </p>
        <Link href="/insumos" className="btn-secondary self-start">
          ← Volver a Insumos
        </Link>
      </div>
    );
  }

  const sedesDestino = sedesVisibles.filter((s) => s.id !== sedeOrigenId);
  const articulos = await obtenerArticulosPorIds(sedeOrigenId, insumoIds);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="eyebrow">
          {sedeOrigen.marca_nombre} / {sedeOrigen.nombre}
        </p>
        <h1 className="text-xl font-semibold">Enviar insumos a otra marca</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Se van a crear como insumos nuevos e independientes en la sede destino, con el mismo
          artículo, subartículo, unidad, Subfamilia y costo de origen como punto de partida — de
          ahí en adelante cada sede maneja su propio costo por separado. Si un insumo ya existe
          con ese mismo nombre en la sede destino, no se toca: queda para resolverlo a mano.
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

      <div className="card p-5">
        <h2 className="mb-2 text-sm font-medium text-slate-700">
          {articulos.length} insumo(s) seleccionado(s)
        </h2>
        <ul className="list-disc pl-5 text-sm" style={{ color: "var(--muted)" }}>
          {articulos.map((a) => (
            <li key={a.id}>{a.articulo}</li>
          ))}
        </ul>
      </div>

      <EnviarInsumosForm
        sedeOrigenId={sedeOrigenId}
        insumoIds={insumoIds}
        sedesDestino={sedesDestino}
      />
    </div>
  );
}
