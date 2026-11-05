import Link from "next/link";
import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import {
  listarInsumosSubSinVincular,
  siguienteReferenciaSubDisponible,
  obtenerSubreceta,
} from "@/lib/data/subrecetas";
import {
  listarIngredientesDeSubreceta,
  listarInsumosParaPicker,
  listarSubrecetasParaPicker,
} from "@/lib/data/ingredientes";
import { listarSubfamilias, listarUnidades } from "@/lib/data/insumos";
import type { ItemOpt } from "@/components/InsumoAutocomplete";
import SubrecetaForm from "../SubrecetaForm";

export default async function NuevaSubrecetaPage({
  searchParams,
}: {
  searchParams: { sede?: string; edit?: string };
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  // Igual que Recetas: esta misma pantalla sirve para crear y para editar.
  // Cuando llega ?edit=ID, se precarga la subreceta existente (datos +
  // ingredientes) y el formulario pasa a modo edición — ver
  // docs/arquitectura.md, sección "Igualar formato de Subrecetas con
  // Recetas".
  const subrecetaExistente = searchParams.edit ? await obtenerSubreceta(searchParams.edit) : null;

  const sedesVisibles = await getSedesVisibles();
  const sedeActiva = resolverSedeActiva(
    usuario,
    sedesVisibles,
    subrecetaExistente?.sede_id ?? searchParams.sede
  );
  if (!sedeActiva) return <p style={{ color: "var(--muted)" }}>No hay ninguna sede disponible.</p>;

  const [insumosSubSinVincular, referenciaSugerida, subfamilias, insumos, subrecetas, unidades, ingredientesExistentes] =
    await Promise.all([
      listarInsumosSubSinVincular(sedeActiva.id),
      siguienteReferenciaSubDisponible(sedeActiva.id),
      listarSubfamilias(sedeActiva.id),
      listarInsumosParaPicker(sedeActiva.id),
      listarSubrecetasParaPicker(sedeActiva.id, subrecetaExistente?.id),
      listarUnidades(),
      subrecetaExistente ? listarIngredientesDeSubreceta(subrecetaExistente.id) : Promise.resolve([]),
    ]);

  // Mismo catálogo combinado insumos + subrecetas que "Nueva receta", para
  // que una subreceta también pueda usar otra subreceta como ingrediente.
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

  const valoresIniciales = subrecetaExistente
    ? {
        nombre: subrecetaExistente.nombre,
        rendimiento: subrecetaExistente.rendimiento ?? 1,
        unidadRendimiento: subrecetaExistente.unidad_rendimiento_codigo ?? "UND",
        desvioPct: subrecetaExistente.desvio_pct * 100,
        lineas: ingredientesExistentes.map((i) => ({
          itemId: (i.tipo_item === "insumo" ? i.insumo_id : i.subreceta_id) ?? "",
          tipoItem: i.tipo_item,
          unidad: i.unidad_codigo ?? "",
          cantidad: i.cantidad,
          mermaPct: i.merma_pct * 100,
        })),
      }
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow">{sedeActiva.marca_nombre} / {sedeActiva.nombre}</p>
          <h1 className="text-xl font-semibold">
            {subrecetaExistente ? "Editar subreceta" : "Nueva subreceta"}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Preparaciones base que se costean como una receta y se usan como insumo en otras.
          </p>
        </div>
        <Link href={`/subrecetas?sede=${sedeActiva.id}`} className="text-sm text-slate-500 hover:underline">
          Volver
        </Link>
      </div>
      <SubrecetaForm
        sedeId={sedeActiva.id}
        insumosSubSinVincular={insumosSubSinVincular}
        referenciaSugerida={referenciaSugerida}
        subfamilias={subfamilias}
        items={items}
        unidades={unidades}
        subrecetaId={subrecetaExistente?.id}
        valoresIniciales={valoresIniciales}
      />
    </div>
  );
}
