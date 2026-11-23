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
  costo_total: number;
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

const AZUL = "FF1E3A5F"; // mismo azul de marca (#1E3A5F) que el resto de la app, en ARGB para exceljs
const AMBAR = "FFF59E0B"; // mismo ámbar de "--warning" que ya usa la app, para distinguir subrecetas de recetas (como en el Excel viejo)
const BLANCO = "FFFFFFFF";
const GRIS_SUBTITULO = "FF64748B";
const GRIS_GENERADO = "FF94A3B8";
const GRIS_ENCABEZADO = "FF334155";
const CEBRA = "FFF8FAFC";

const FORMATO_MONEDA_ENTERA = '"$"#,##0';

/** Nombre de la unidad en mayúsculas a partir de su código (ej. "GR" → "GRAMOS"),
 * o el código tal cual si no está en el mapa — nunca se inventa una unidad nueva. */
function nombreUnidad(codigo: string | null, unidadesPorCodigo: Record<string, string>): string {
  if (!codigo) return "";
  return (unidadesPorCodigo[codigo] ?? codigo).toUpperCase();
}

/** Número entero con separador de miles "." (formato es-CO), sin decimales
 * — así se ven "Costo total", "Costo del plato", "Precio real" y "Rinde"
 * en el Excel viejo que mandó Mariluz. */
function miles(n: number): string {
  return Math.round(n).toLocaleString("es-CO");
}

/** Número con 2 decimales y coma decimal (formato es-CO) — así se ve
 * "Costo por {unidad}" en el Excel viejo, con más precisión que los demás
 * montos porque es un costo unitario, no un total. */
function dosDecimales(n: number): string {
  return n.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Food Cost con 1 decimal y punto (no coma) — así se ve en el Excel viejo;
 * es una inconsistencia del sistema original (los demás números usan coma
 * decimal) pero se replica tal cual, sin "corregirla". */
function porcentajeFoodCost(fraccion: number): string {
  return `${(fraccion * 100).toFixed(1)}%`;
}

/** "% Merma" es texto literal en el Excel viejo, no un número con formato
 * de Excel: vacío si no hay merma, o "10%" (sin decimales) si la hay. */
function textoMerma(mermaPct: number): string {
  if (!mermaPct) return "";
  return `${Math.round(mermaPct * 100)}%`;
}

function estilizarTitulo(sh: ExcelJS.Worksheet, fila: ExcelJS.Row, ultimaColumna: number, colorFondo: string) {
  fila.eachCell({ includeEmpty: true }, (celda) => {
    celda.font = { bold: true, size: 12, color: { argb: BLANCO } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colorFondo } };
  });
  sh.mergeCells(fila.number, 1, fila.number, ultimaColumna);
  fila.height = 22;
}

function estilizarSubtitulo(sh: ExcelJS.Worksheet, fila: ExcelJS.Row, ultimaColumna: number) {
  fila.eachCell({ includeEmpty: true }, (celda) => {
    celda.font = { size: 9, color: { argb: GRIS_SUBTITULO } };
  });
  sh.mergeCells(fila.number, 1, fila.number, ultimaColumna);
}

function estilizarEncabezadoColumnas(fila: ExcelJS.Row) {
  fila.eachCell((celda) => {
    celda.font = { bold: true, size: 9, color: { argb: GRIS_ENCABEZADO } };
  });
}

/** Arma una hoja de bloques (una por receta o por subreceta): cada bloque
 * tiene un título con fondo de color (azul para recetas, ámbar para
 * subrecetas — igual que el Excel viejo, que también distingue el color
 * según el tipo de bloque), una línea de resumen gris chica, el
 * encabezado de columnas de sus ingredientes, las filas de ingredientes
 * (con cebreado que arranca de nuevo en cada bloque) y dos filas en blanco
 * antes del próximo bloque. Columna A queda vacía como sangría — así es
 * el Excel viejo que mandó Mariluz. */
function armarHojaBloques(
  wb: ExcelJS.Workbook,
  nombreHoja: string,
  bloques: { titulo: string; subtitulo: string; ingredientes: LineaIngrediente[] }[],
  unidadesPorCodigo: Record<string, string>,
  colorTitulo: string
) {
  const sh = wb.addWorksheet(nombreHoja, {
    views: [{ showGridLines: false }],
  });
  sh.columns = [
    { key: "a", width: 4 },
    { key: "b", width: 42 },
    { key: "c", width: 12 },
    { key: "d", width: 11 },
    { key: "e", width: 10 },
    { key: "f", width: 10 },
    { key: "g", width: 14 },
    { key: "h", width: 12 },
  ];

  bloques.forEach((bloque) => {
    const filaTitulo = sh.addRow([bloque.titulo]);
    estilizarTitulo(sh, filaTitulo, 8, colorTitulo);

    const filaSubtitulo = sh.addRow([bloque.subtitulo]);
    estilizarSubtitulo(sh, filaSubtitulo, 8);

    const filaEncabezado = sh.addRow(["", "Ingrediente", "Tipo", "Cantidad", "Unidad", "% Merma", "Costo unit.", "Costo línea"]);
    estilizarEncabezadoColumnas(filaEncabezado);

    bloque.ingredientes.forEach((i, idx) => {
      const fila = sh.addRow([
        "",
        i.descripcion,
        i.tipo_item === "subreceta" ? "Subreceta" : "Insumo",
        i.cantidad,
        nombreUnidad(i.unidad_codigo, unidadesPorCodigo),
        textoMerma(i.merma_pct),
        i.costo_unitario,
        i.costo_linea,
      ]);
      fila.getCell(7).numFmt = FORMATO_MONEDA_ENTERA;
      fila.getCell(8).numFmt = FORMATO_MONEDA_ENTERA;
      fila.font = { size: 10 };
      if (idx % 2 === 1) {
        fila.eachCell({ includeEmpty: true }, (celda) => {
          celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CEBRA } };
        });
      }
    });

    sh.addRow([]);
    sh.addRow([]);
  });

  return sh;
}

/**
 * Arma el Excel del recetario completo con la misma estructura del
 * GastroCore viejo (a pedido de Mariluz, 23/11): una portada, y una hoja
 * "Recetas" y otra "Subrecetas" con un bloque por cada una (título +
 * resumen + su detalle de ingredientes), en vez de las tablas planas con
 * una fila por receta que tenía la versión anterior de este archivo. Los
 * datos y las fórmulas son los mismos que ya se ven en pantalla en
 * `/recetas` y `/subrecetas` — esto solo cambia cómo se acomodan en el
 * Excel, no calcula nada nuevo.
 *
 * Las fichas técnicas (si se piden) ya no se agregan como columnas extra
 * acá: el Excel viejo no las tiene, y Mariluz pidió calcar esa estructura
 * "tal cual". Se puede seguir descargando cada ficha en PDF por separado
 * desde el detalle de cada receta, como ya existía.
 */
export async function generarExcelRecetario(datos: {
  sedeNombre: string;
  recetas: RecetaFila[];
  subrecetas: SubrecetaFila[];
  ingredientesRecetas: LineaIngrediente[];
  ingredientesSubrecetas: LineaIngrediente[];
  unidadesPorCodigo: Record<string, string>;
  incluyeFichas: boolean;
  soloActivas: boolean;
}): Promise<Buffer> {
  const {
    sedeNombre,
    recetas,
    subrecetas,
    ingredientesRecetas,
    ingredientesSubrecetas,
    unidadesPorCodigo,
    incluyeFichas,
    soloActivas,
  } = datos;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Gastro Central";
  wb.created = new Date();
  wb.properties.date1904 = false;

  // --- Hoja "Portada" ---
  const shPortada = wb.addWorksheet("Portada", { views: [{ showGridLines: false }] });
  shPortada.getColumn(2).width = 60;

  shPortada.getCell("B3").value = sedeNombre;
  shPortada.getCell("B3").font = { bold: true, size: 22, color: { argb: AZUL } };

  shPortada.getCell("B4").value = "Relación completa de recetas y subrecetas";
  shPortada.getCell("B4").font = { size: 12, color: { argb: GRIS_SUBTITULO } };

  const generado = new Date().toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const detalles = [incluyeFichas ? "con fichas técnicas" : "sin fichas técnicas", soloActivas ? "solo activas" : "activas e inactivas"];
  shPortada.getCell("B6").value = `Generado: ${generado}   ·   ${detalles.join("   ·   ")}`;
  shPortada.getCell("B6").font = { size: 9, color: { argb: GRIS_GENERADO } };

  // --- Hoja "Recetas" ---
  const ingredientesPorReceta = new Map<string, LineaIngrediente[]>();
  ingredientesRecetas.forEach((i) => {
    const lista = ingredientesPorReceta.get(i.duenoNombre) ?? [];
    lista.push(i);
    ingredientesPorReceta.set(i.duenoNombre, lista);
  });

  const bloquesRecetas = recetas.map((r) => {
    const fc = r.precio_real ? foodCost(r.costo_porcion, r.precio_real, r.iva) : 0;
    const rendimiento = r.rendimiento ?? 1;
    const partes = [
      `${miles(rendimiento)} porción(es)`,
      `Costo del plato $${miles(r.costo_porcion)}`,
      r.precio_real !== null ? `Precio real $${miles(r.precio_real)}` : null,
      r.precio_real !== null ? `Food Cost ${porcentajeFoodCost(fc)}` : null,
    ].filter((p): p is string => p !== null);

    return {
      titulo: r.familia_nombre ? `${r.nombre}   ·   ${r.familia_nombre}` : r.nombre,
      subtitulo: partes.join("   ·   "),
      ingredientes: ingredientesPorReceta.get(r.nombre) ?? [],
    };
  });
  armarHojaBloques(wb, "Recetas", bloquesRecetas, unidadesPorCodigo, AZUL);

  // --- Hoja "Subrecetas" ---
  const ingredientesPorSubreceta = new Map<string, LineaIngrediente[]>();
  ingredientesSubrecetas.forEach((i) => {
    const lista = ingredientesPorSubreceta.get(i.duenoNombre) ?? [];
    lista.push(i);
    ingredientesPorSubreceta.set(i.duenoNombre, lista);
  });

  const bloquesSubrecetas = subrecetas.map((s) => {
    const unidad = nombreUnidad(s.unidad_rendimiento_codigo, unidadesPorCodigo);
    const rendimiento = s.rendimiento ?? 1;
    const partes = [
      `Rinde ${miles(rendimiento)}${unidad ? ` ${unidad}` : ""}`,
      `Costo total $${miles(s.costo_total)}`,
      `Costo por ${unidad || "unidad"} $${dosDecimales(s.costo_unitario)}`,
    ];

    return {
      titulo: s.nombre,
      subtitulo: partes.join("   ·   "),
      ingredientes: ingredientesPorSubreceta.get(s.nombre) ?? [],
    };
  });
  armarHojaBloques(wb, "Subrecetas", bloquesSubrecetas, unidadesPorCodigo, AMBAR);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
