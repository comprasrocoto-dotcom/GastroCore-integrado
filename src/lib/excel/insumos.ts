import ExcelJS from "exceljs";
import type { InsumoFila } from "@/lib/data/insumos";

const AZUL = "FF1E3A5F"; // mismo azul de marca (#1E3A5F) que el resto de la app, en ARGB para exceljs
const BLANCO = "FFFFFFFF";
const GRIS_SUBTITULO = "FF64748B";
const GRIS_GENERADO = "FF94A3B8";
const GRIS_ENCABEZADO = "FF334155";
const CEBRA = "FFF8FAFC";

const FORMATO_MONEDA_ENTERA = '"$"#,##0';

/**
 * Arma el Excel del listado de Insumos (23/11, botón "Descargar Excel" a
 * pedido de Mariluz): una sola hoja con una fila por insumo, respetando la
 * búsqueda y los filtros (subfamilia, Centro de costo) que estén activos
 * en pantalla — los mismos datos que ya se ven en `/insumos`, no se
 * calcula nada nuevo acá.
 */
export async function generarExcelInsumos(datos: {
  sedeNombre: string;
  insumos: InsumoFila[];
  detalleFiltros: string[];
}): Promise<Buffer> {
  const { sedeNombre, insumos, detalleFiltros } = datos;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Gastro Central";
  wb.created = new Date();
  wb.properties.date1904 = false;

  const sh = wb.addWorksheet("Insumos", { views: [{ showGridLines: false }] });
  sh.columns = [
    { key: "referencia", width: 12 },
    { key: "articulo", width: 40 },
    { key: "subarticulo", width: 20 },
    { key: "subfamilia", width: 22 },
    { key: "centroCosto", width: 14 },
    { key: "unidad", width: 10 },
    { key: "mermaStd", width: 10 },
    { key: "coste", width: 12 },
    { key: "activo", width: 10 },
  ];

  const filaTitulo = sh.addRow([sedeNombre]);
  sh.mergeCells(filaTitulo.number, 1, filaTitulo.number, 9);
  filaTitulo.getCell(1).font = { bold: true, size: 18, color: { argb: AZUL } };
  filaTitulo.height = 26;

  const filaSubtitulo = sh.addRow(["Listado de insumos"]);
  sh.mergeCells(filaSubtitulo.number, 1, filaSubtitulo.number, 9);
  filaSubtitulo.getCell(1).font = { size: 12, color: { argb: GRIS_SUBTITULO } };

  const generado = new Date().toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const partesGenerado = [`Generado: ${generado}`, `${insumos.length} insumo(s)`, ...detalleFiltros];
  const filaGenerado = sh.addRow([partesGenerado.join("   ·   ")]);
  sh.mergeCells(filaGenerado.number, 1, filaGenerado.number, 9);
  filaGenerado.getCell(1).font = { size: 9, color: { argb: GRIS_GENERADO } };

  sh.addRow([]);

  const filaEncabezado = sh.addRow([
    "Referencia",
    "Artículo",
    "Subartículo",
    "Subfamilia",
    "Centro de costo",
    "Unidad",
    "% Merma",
    "Costo",
    "Activo",
  ]);
  filaEncabezado.eachCell({ includeEmpty: true }, (celda) => {
    celda.font = { bold: true, size: 10, color: { argb: BLANCO } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_ENCABEZADO } };
  });
  filaEncabezado.height = 20;

  insumos.forEach((i, idx) => {
    const fila = sh.addRow([
      i.referencia ?? "",
      i.articulo,
      i.subarticulo ?? "",
      i.subfamilia_nombre ?? "",
      i.centro_costo ?? "",
      i.unidad_codigo ?? "",
      i.merma_std ? `${Math.round(i.merma_std * 100)}%` : "",
      i.coste,
      i.activo ? "Sí" : "No",
    ]);
    fila.getCell(8).numFmt = FORMATO_MONEDA_ENTERA;
    fila.font = { size: 10 };
    if (idx % 2 === 1) {
      fila.eachCell({ includeEmpty: true }, (celda) => {
        celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CEBRA } };
      });
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
