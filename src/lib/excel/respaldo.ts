import ExcelJS from "exceljs";

const AZUL = "FF1E3A5F";
const BLANCO = "FFFFFFFF";

function estilizarEncabezado(fila: ExcelJS.Row) {
  fila.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: BLANCO } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    celda.alignment = { vertical: "middle" };
  });
  fila.height = 20;
}

type InsumoFila = {
  referencia: string | null;
  articulo: string;
  subarticulo: string | null;
  familia_nombre: string | null;
  subfamilia_nombre: string | null;
  unidad_codigo: string | null;
  coste: number;
  merma_std: number | null;
  activo: boolean;
};

type FamiliaFila = {
  nombre: string;
  tipo: string | null;
  centrocosto: string | null;
  fc_objetivo: number | null;
  activo: boolean;
};

type SubrecetaFila = {
  nombre: string;
  rendimiento: number | null;
  unidad_rendimiento_codigo: string | null;
  costo_unitario: number;
  activo: boolean;
};

type RecetaFila = {
  nombre: string;
  familia_nombre: string | null;
  rendimiento: number | null;
  unidad_rendimiento_codigo: string | null;
  costo_porcion: number;
  precio_real: number | null;
  activo: boolean;
};

/**
 * "Respaldo de la base" (27/10) — una copia en Excel de los datos
 * maestros de la sede (insumos, familias, subrecetas, recetas), sin
 * detalle de ingredientes ni fichas técnicas (eso ya lo cubre la
 * exportación de `/recetas/exportar`, que es más completa pero también
 * más pesada). Pensado como respaldo rápido, igual que "Descargar copia
 * (Excel)" del sistema viejo — mismos datos que ya se ven en pantalla,
 * no inventa ni recalcula nada.
 */
export async function generarExcelRespaldo(datos: {
  sedeNombre: string;
  insumos: InsumoFila[];
  familias: FamiliaFila[];
  subrecetas: SubrecetaFila[];
  recetas: RecetaFila[];
}): Promise<Buffer> {
  const { sedeNombre, insumos, familias, subrecetas, recetas } = datos;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Gastro Central";
  wb.created = new Date();

  const shInsumos = wb.addWorksheet("Insumos");
  shInsumos.columns = [
    { header: "Referencia", key: "referencia", width: 14 },
    { header: "Artículo", key: "articulo", width: 32 },
    { header: "Subartículo", key: "subarticulo", width: 24 },
    { header: "Familia", key: "familia", width: 18 },
    { header: "Subfamilia", key: "subfamilia", width: 18 },
    { header: "Unidad", key: "unidad", width: 10 },
    { header: "Costo", key: "costo", width: 12 },
    { header: "Merma estándar", key: "merma", width: 14 },
    { header: "Activo", key: "activo", width: 9 },
  ];
  estilizarEncabezado(shInsumos.getRow(1));
  for (const i of insumos) {
    shInsumos.addRow({
      referencia: i.referencia ?? "",
      articulo: i.articulo,
      subarticulo: i.subarticulo ?? "",
      familia: i.familia_nombre ?? "",
      subfamilia: i.subfamilia_nombre ?? "",
      unidad: i.unidad_codigo ?? "",
      costo: i.coste,
      merma: i.merma_std !== null ? `${(i.merma_std * 100).toFixed(2)}%` : "",
      activo: i.activo ? "Sí" : "No",
    });
  }

  const shFamilias = wb.addWorksheet("Familias");
  shFamilias.columns = [
    { header: "Familia", key: "nombre", width: 28 },
    { header: "Tipo", key: "tipo", width: 16 },
    { header: "Área (centro de costo)", key: "centrocosto", width: 18 },
    { header: "Food cost objetivo", key: "fc", width: 16 },
    { header: "Activa", key: "activo", width: 9 },
  ];
  estilizarEncabezado(shFamilias.getRow(1));
  for (const f of familias) {
    shFamilias.addRow({
      nombre: f.nombre,
      tipo: f.tipo ?? "",
      centrocosto: f.centrocosto ?? "",
      fc: f.fc_objetivo !== null ? `${(f.fc_objetivo * 100).toFixed(2)}%` : "",
      activo: f.activo ? "Sí" : "No",
    });
  }

  const shSubrecetas = wb.addWorksheet("Subrecetas");
  shSubrecetas.columns = [
    { header: "Subreceta", key: "nombre", width: 32 },
    { header: "Rendimiento", key: "rendimiento", width: 12 },
    { header: "Unidad", key: "unidad", width: 10 },
    { header: "Costo unitario", key: "costo", width: 14 },
    { header: "Activa", key: "activo", width: 9 },
  ];
  estilizarEncabezado(shSubrecetas.getRow(1));
  for (const s of subrecetas) {
    shSubrecetas.addRow({
      nombre: s.nombre,
      rendimiento: s.rendimiento ?? "",
      unidad: s.unidad_rendimiento_codigo ?? "",
      costo: s.costo_unitario,
      activo: s.activo ? "Sí" : "No",
    });
  }

  const shRecetas = wb.addWorksheet("Recetas");
  shRecetas.columns = [
    { header: "Receta", key: "nombre", width: 34 },
    { header: "Familia", key: "familia", width: 20 },
    { header: "Rendimiento", key: "rendimiento", width: 12 },
    { header: "Unidad", key: "unidad", width: 10 },
    { header: "Costo porción", key: "costo", width: 14 },
    { header: "Precio real", key: "precio", width: 14 },
    { header: "Activa", key: "activo", width: 9 },
  ];
  estilizarEncabezado(shRecetas.getRow(1));
  for (const r of recetas) {
    shRecetas.addRow({
      nombre: r.nombre,
      familia: r.familia_nombre ?? "",
      rendimiento: r.rendimiento ?? "",
      unidad: r.unidad_rendimiento_codigo ?? "",
      costo: r.costo_porcion,
      precio: r.precio_real ?? "",
      activo: r.activo ? "Sí" : "No",
    });
  }

  const shPortada = wb.addWorksheet("Respaldo", { views: [{ showGridLines: false }] });
  shPortada.getCell("A1").value = `Respaldo de ${sedeNombre}`;
  shPortada.getCell("A1").font = { bold: true, size: 14 };
  shPortada.getCell("A2").value = `Generado el ${new Date().toLocaleDateString("es-CO")}`;
  shPortada.getCell("A3").value =
    "Copia de los datos maestros (insumos, familias, subrecetas, recetas). No incluye el detalle de ingredientes de cada receta ni las fichas técnicas — para eso usá la exportación del Recetario.";
  shPortada.getColumn("A").width = 90;
  wb.worksheets = [shPortada, ...wb.worksheets.filter((w) => w !== shPortada)];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
