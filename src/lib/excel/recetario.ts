import ExcelJS from "exceljs";
import { foodCost } from "@/lib/costeo";

type RecetaFila = {
  nombre: string;
  familia_nombre: string | null;
  rendimiento: number | null;
  unidad_rendimiento_codigo: string | null;
  costo_porcion: number;
  precio_real: number | null;
  iva: number;
  activo: boolean;
};

type SubrecetaFila = {
  nombre: string;
  rendimiento: number | null;
  unidad_rendimiento_codigo: string | null;
  costo_unitario: number;
  activo: boolean;
};

type LineaIngrediente = {
  duenoNombre: string;
  tipo_item: "insumo" | "subreceta";
  descripcion: string;
  cantidad: number;
  unidad_codigo: string | null;
  merma_pct: number;
  costo_unitario: number;
  costo_linea: number;
};

type FichaTecnica = {
  recetaNombre: string;
  preparacion: string | null;
  emplatado: string | null;
  notas: string | null;
  tiempo_min: number | null;
  gramaje_porcion: number | null;
};

const AZUL = "FF1E3A5F"; // mismo azul de marca (#1E3A5F) que el resto de la app, en ARGB para exceljs
const BLANCO = "FFFFFFFF";

function estilizarEncabezado(fila: ExcelJS.Row) {
  fila.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: BLANCO } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    celda.alignment = { vertical: "middle" };
  });
  fila.height = 20;
}

/**
 * Arma el Excel del recetario completo: una hoja por recetas y otra por
 * subrecetas (nombre, familia/rendimiento, costo, precio, estado), más una
 * hoja de detalle de ingredientes de cada una — el mismo dato que ya se ve
 * en pantalla en `/recetas` y `/subrecetas`, sin recalcular ni inventar
 * nada. Las fichas técnicas (si se piden) se agregan como columnas extra
 * de texto en la hoja de Recetas, porque solo las recetas tienen ficha
 * técnica en la base — las subrecetas no.
 */
export async function generarExcelRecetario(datos: {
  sedeNombre: string;
  recetas: RecetaFila[];
  subrecetas: SubrecetaFila[];
  ingredientesRecetas: LineaIngrediente[];
  ingredientesSubrecetas: LineaIngrediente[];
  fichas: FichaTecnica[] | null;
}): Promise<Buffer> {
  const { sedeNombre, recetas, subrecetas, ingredientesRecetas, ingredientesSubrecetas, fichas } = datos;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Gastro Central";
  wb.created = new Date();

  const fichaPorReceta = new Map<string, FichaTecnica>();
  fichas?.forEach((f) => fichaPorReceta.set(f.recetaNombre, f));

  // --- Hoja "Recetas" ---
  const shRecetas = wb.addWorksheet("Recetas");
  const columnasRecetas: Partial<ExcelJS.Column>[] = [
    { header: "Receta", key: "nombre", width: 34 },
    { header: "Familia", key: "familia", width: 20 },
    { header: "Rendimiento", key: "rendimiento", width: 12 },
    { header: "Unidad", key: "unidad", width: 10 },
    { header: "Costo porción", key: "costo", width: 14 },
    { header: "Precio real", key: "precio", width: 14 },
    { header: "Food cost", key: "foodcost", width: 11 },
    { header: "Activa", key: "activa", width: 9 },
  ];
  if (fichas) {
    columnasRecetas.push(
      { header: "Preparación", key: "preparacion", width: 40 },
      { header: "Emplatado", key: "emplatado", width: 30 },
      { header: "Notas", key: "notas", width: 30 },
      { header: "Tiempo (min)", key: "tiempo", width: 12 },
      { header: "Gramaje/porción", key: "gramaje", width: 14 }
    );
  }
  shRecetas.columns = columnasRecetas;

  recetas.forEach((r) => {
    const fc = r.precio_real ? foodCost(r.costo_porcion, r.precio_real, r.iva) : null;
    const fila: Record<string, unknown> = {
      nombre: r.nombre,
      familia: r.familia_nombre ?? "Sin familia",
      rendimiento: r.rendimiento,
      unidad: r.unidad_rendimiento_codigo ?? "",
      costo: r.costo_porcion,
      precio: r.precio_real ?? null,
      foodcost: fc,
      activa: r.activo ? "Sí" : "No",
    };
    if (fichas) {
      const ficha = fichaPorReceta.get(r.nombre);
      fila.preparacion = ficha?.preparacion ?? "";
      fila.emplatado = ficha?.emplatado ?? "";
      fila.notas = ficha?.notas ?? "";
      fila.tiempo = ficha?.tiempo_min ?? "";
      fila.gramaje = ficha?.gramaje_porcion ?? "";
    }
    shRecetas.addRow(fila);
  });
  estilizarEncabezado(shRecetas.getRow(1));
  shRecetas.getColumn("costo").numFmt = '"$"#,##0';
  shRecetas.getColumn("precio").numFmt = '"$"#,##0';
  shRecetas.getColumn("foodcost").numFmt = "0.0%";
  shRecetas.views = [{ state: "frozen", ySplit: 1 }];
  shRecetas.autoFilter = { from: "A1", to: `${fichas ? "M" : "H"}1` };

  // --- Hoja "Ingredientes de recetas" ---
  const shIngRecetas = wb.addWorksheet("Ingredientes de recetas");
  shIngRecetas.columns = [
    { header: "Receta", key: "dueno", width: 30 },
    { header: "Ingrediente", key: "ingrediente", width: 34 },
    { header: "Tipo", key: "tipo", width: 12 },
    { header: "Cantidad", key: "cantidad", width: 11 },
    { header: "Unidad", key: "unidad", width: 10 },
    { header: "% Merma", key: "merma", width: 10 },
    { header: "Costo unit.", key: "costounit", width: 12 },
    { header: "Costo línea", key: "costolinea", width: 12 },
  ];
  ingredientesRecetas.forEach((i) =>
    shIngRecetas.addRow({
      dueno: i.duenoNombre,
      ingrediente: i.descripcion,
      tipo: i.tipo_item === "subreceta" ? "Subreceta" : "Insumo",
      cantidad: i.cantidad,
      unidad: i.unidad_codigo ?? "",
      merma: i.merma_pct,
      costounit: i.costo_unitario,
      costolinea: i.costo_linea,
    })
  );
  estilizarEncabezado(shIngRecetas.getRow(1));
  shIngRecetas.getColumn("merma").numFmt = "0.0%";
  shIngRecetas.getColumn("costounit").numFmt = '"$"#,##0';
  shIngRecetas.getColumn("costolinea").numFmt = '"$"#,##0';
  shIngRecetas.views = [{ state: "frozen", ySplit: 1 }];
  shIngRecetas.autoFilter = { from: "A1", to: "H1" };

  // --- Hoja "Subrecetas" ---
  const shSub = wb.addWorksheet("Subrecetas");
  shSub.columns = [
    { header: "Subreceta", key: "nombre", width: 34 },
    { header: "Rendimiento", key: "rendimiento", width: 12 },
    { header: "Unidad", key: "unidad", width: 10 },
    { header: "Costo unitario", key: "costo", width: 14 },
    { header: "Activa", key: "activa", width: 9 },
  ];
  subrecetas.forEach((s) =>
    shSub.addRow({
      nombre: s.nombre,
      rendimiento: s.rendimiento,
      unidad: s.unidad_rendimiento_codigo ?? "",
      costo: s.costo_unitario,
      activa: s.activo ? "Sí" : "No",
    })
  );
  estilizarEncabezado(shSub.getRow(1));
  shSub.getColumn("costo").numFmt = '"$"#,##0';
  shSub.views = [{ state: "frozen", ySplit: 1 }];
  shSub.autoFilter = { from: "A1", to: "E1" };

  // --- Hoja "Ingredientes de subrecetas" ---
  const shIngSub = wb.addWorksheet("Ingredientes de subrecetas");
  shIngSub.columns = [
    { header: "Subreceta", key: "dueno", width: 30 },
    { header: "Ingrediente", key: "ingrediente", width: 34 },
    { header: "Tipo", key: "tipo", width: 12 },
    { header: "Cantidad", key: "cantidad", width: 11 },
    { header: "Unidad", key: "unidad", width: 10 },
    { header: "% Merma", key: "merma", width: 10 },
    { header: "Costo unit.", key: "costounit", width: 12 },
    { header: "Costo línea", key: "costolinea", width: 12 },
  ];
  ingredientesSubrecetas.forEach((i) =>
    shIngSub.addRow({
      dueno: i.duenoNombre,
      ingrediente: i.descripcion,
      tipo: i.tipo_item === "subreceta" ? "Subreceta" : "Insumo",
      cantidad: i.cantidad,
      unidad: i.unidad_codigo ?? "",
      merma: i.merma_pct,
      costounit: i.costo_unitario,
      costolinea: i.costo_linea,
    })
  );
  estilizarEncabezado(shIngSub.getRow(1));
  shIngSub.getColumn("merma").numFmt = "0.0%";
  shIngSub.getColumn("costounit").numFmt = '"$"#,##0';
  shIngSub.getColumn("costolinea").numFmt = '"$"#,##0';
  shIngSub.views = [{ state: "frozen", ySplit: 1 }];
  shIngSub.autoFilter = { from: "A1", to: "H1" };

  wb.properties.date1904 = false;
  shRecetas.getCell("A1").note = `Generado para ${sedeNombre} — Gastro Central`;

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
