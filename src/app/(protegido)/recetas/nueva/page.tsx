import Link from "next/link";
import { getUsuarioActual, tieneModulo } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import { listarFamiliasParaPicker, obtenerReceta } from "@/lib/data/recetas";
import {
  listarIngredientesDeReceta,
  listarInsumosParaPicker,
  listarSubrecetasParaPicker,
} from "@/lib/data/ingredientes";
import { listarUnidades } from "@/lib/data/insumos";
import { obtenerConfiguracionCosteo } from "@/lib/data/configuracion";
import type { ItemOpt } from "@/components/InsumoAutocomplete";
import RecetaForm from "../RecetaForm";

export default async function NuevaRecetaPage({
  searchParams,
}: {
  searchParams: { sede?: string; edit?: string };
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  if (!tieneModulo(usuario, "recetas")) {
    return (
      <p style={{ color: "var(--muted)" }}>
        No tenés permiso para ver esta pantalla.
      </p>
    );
  }

  // Igual que GastroCore: esta misma pantalla sirve para crear y para
  // editar. Cuando llega ?edit=ID, se precarga la receta existente (datos
  // + ingredientes) y el formulario pasa a modo edición.
  const recetaExistente = searchParams.edit ? await obtenerReceta(searchParams.edit) : null;

  // Si el usuario tiene un área personal asignada y la receta que quiere
  // editar es de la otra área (Bar/Cocina de su familia), se bloquea acá
  // — igual criterio que el filtro de familias de abajo, pero aplicado a
  // una receta puntual por si alguien entra directo con el ID por URL.
  if (usuario.area && recetaExistente) {
    const c = (recetaExistente.familia_centrocosto ?? "").toUpperCase();
    const visible = !c || c === "AMBAS" || c === usuario.area;
    if (!visible) {
      return (
        <p style={{ color: "var(--muted)" }}>
          No tenés permiso para editar esta receta.
        </p>
      );
    }
  }

  const sedesVisibles = await getSedesVisibles();
  const sedeActiva = resolverSedeActiva(
    usuario,
    sedesVisibles,
    recetaExistente?.sede_id ?? searchParams.sede
  );
  if (!sedeActiva) return <p style={{ color: "var(--muted)" }}>No hay ninguna sede disponible.</p>;

  const [familiasSinArea, insumos, subrecetas, unidades, configCosteo, ingredientesExistentes] =
    await Promise.all([
      listarFamiliasParaPicker(sedeActiva.id),
      listarInsumosParaPicker(sedeActiva.id),
      listarSubrecetasParaPicker(sedeActiva.id),
      listarUnidades(),
      obtenerConfiguracionCosteo(sedeActiva.id),
      recetaExistente ? listarIngredientesDeReceta(recetaExistente.id) : Promise.resolve([]),
    ]);

  // Mismo filtro de área que recetas/page.tsx, para que el selector de
  // familia de este formulario no ofrezca familias de la otra área.
  const familias = usuario.area
    ? familiasSinArea.filter((f) => {
        const c = (f.centrocosto ?? "").toUpperCase();
        return !c || c === "AMBAS" || c === usuario.area;
      })
    : familiasSinArea;

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

  const valoresIniciales = recetaExistente
    ? {
        nombre: recetaExistente.nombre,
        rendimiento: recetaExistente.rendimiento ?? 1,
        unidadRendimiento: recetaExistente.unidad_rendimiento_codigo ?? "UND",
        desvioPct: recetaExistente.desvio_pct * 100,
        familiaId: recetaExistente.familia_id ?? "",
        precioReal: recetaExistente.precio_real ?? 0,
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
            {recetaExistente ? "Editar receta" : "Nueva receta"}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Costeo por ingrediente con merma real, sincronizado con la base.
        </p>
      </div>
        <Link href={`/recetas?sede=${sedeActiva.id}`} className="text-sm text-slate-500 hover:underline">
          Volver
        </Link>
      </div>
      <RecetaForm
        sedeId={sedeActiva.id}
        familias={familias}
        items={items}
        unidades={unidades}
        configCosteo={configCosteo}
        recetaId={recetaExistente?.id}
        valoresIniciales={valoresIniciales}
      />
    </div>
  );
}
