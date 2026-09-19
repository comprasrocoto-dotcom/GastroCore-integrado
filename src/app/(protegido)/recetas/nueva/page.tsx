import Link from "next/link";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import { listarFamiliasParaPicker } from "@/lib/data/recetas";
import { listarInsumosParaPicker, listarSubrecetasParaPicker } from "@/lib/data/ingredientes";
import { listarUnidades } from "@/lib/data/insumos";
import type { ItemOpt } from "@/components/InsumoAutocomplete";
import RecetaForm from "../RecetaForm";

export default async function NuevaRecetaPage({
  searchParams,
}: {
  searchParams: { sede?: string };
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  const sedesVisibles = await getSedesVisibles();
  const sedeActiva = resolverSedeActiva(usuario, sedesVisibles, searchParams.sede);
  if (!sedeActiva) return <p style={{ color: "var(--muted)" }}>No hay ninguna sede disponible.</p>;

  const [familias, insumos, subrecetas, unidades] = await Promise.all([
    listarFamiliasParaPicker(sedeActiva.id),
    listarInsumosParaPicker(sedeActiva.id),
    listarSubrecetasParaPicker(sedeActiva.id),
    listarUnidades(),
  ]);

  // Un solo listado para el buscador de ingredientes: insumos + subrecetas,
  // igual que el "catálogo" combinado de GastroCore.
  const items: ItemOpt[] = [
    ...insumos.map((i) => ({
      id: i.id,
      tipo_item: "insumo" as const,
      articulo: i.etiqueta,
      referencia: i.referencia,
      unidad: i.unidad_codigo,
      coste: i.coste,
      subfamilia: i.subfamilia_nombre,
      merma_std: i.merma_std,
    })),
    ...subrecetas.map((s) => ({
      id: s.id,
      tipo_item: "subreceta" as const,
      articulo: s.etiqueta,
      referencia: null,
      unidad: s.unidad_codigo,
      coste: s.costo_unitario,
      subfamilia: null,
      merma_std: 0,
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow">{sedeActiva.marca_nombre} / {sedeActiva.nombre}</p>
          <h1 className="text-xl font-semibold">Nueva receta</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Costeo por ingrediente con merma real, sincronizado con la base.
          </p>
        </div>
        <Link href={`/recetas?sede=${sedeActiva.id}`} className="text-sm text-slate-500 hover:underline">
          Volver
        </Link>
      </div>
      <RecetaForm sedeId={sedeActiva.id} familias={familias} items={items} unidades={unidades} />
    </div>
  );
}
