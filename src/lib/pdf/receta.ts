import { PDFDocument, StandardFonts, rgb, type RGB, type PDFFont, type PDFPage } from "pdf-lib";

type IngredienteLinea = {
  tipo_item: "insumo" | "subreceta";
  descripcion: string;
  unidad_codigo: string | null;
  cantidad: number;
  merma_pct: number;
  costo_unitario: number;
  costo_linea: number;
};

type RecetaDatos = {
  nombre: string;
  familia_nombre: string | null;
  sede_nombre: string | null;
  rendimiento: number | null;
  costo_porcion: number;
  precio_real: number | null;
};

type ResumenCosteo = {
  foodCost: number;
};

const ANCHO = 595.28; // A4
const ALTO = 841.89;
const MARGEN = 40;
const ANCHO_UTIL = ANCHO - MARGEN * 2;

const AZUL: RGB = rgb(0.118, 0.227, 0.373); // #1E3A5F — mismo azul de marca que el resto de la app
const AZUL_CLARO: RGB = rgb(0.29, 0.56, 0.89); // acento
const GRIS: RGB = rgb(0.42, 0.46, 0.52);
const GRIS_CLARO: RGB = rgb(0.85, 0.86, 0.88);
const NEGRO: RGB = rgb(0.12, 0.13, 0.15);
const FILA_PAR: RGB = rgb(0.96, 0.97, 0.98);
const BLANCO: RGB = rgb(1, 1, 1);

const money = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-CO");

/** "50,6" si tiene fracción, "50" si es entero. */
function formatCantidad(n: number): string {
  const redondeado = Math.round(n * 10) / 10;
  return Number.isInteger(redondeado) ? String(redondeado) : redondeado.toFixed(1).replace(".", ",");
}

const COLUMNAS = [
  { titulo: "Ingrediente", ancho: 145, alinear: "izq" as const },
  { titulo: "Tipo", ancho: 55, alinear: "izq" as const },
  { titulo: "Cantidad", ancho: 45, alinear: "der" as const },
  { titulo: "Unidad", ancho: 55, alinear: "izq" as const },
  { titulo: "% Merma", ancho: 50, alinear: "der" as const },
  { titulo: "Cant. real", ancho: 55, alinear: "der" as const },
  { titulo: "Costo unit.", ancho: 55, alinear: "der" as const },
  { titulo: "Costo línea", ancho: 55, alinear: "der" as const },
];
const ALTO_FILA_TABLA = 18;
const ALTO_HEADER_TABLA = 22;

/**
 * Genera el PDF de una receta con el mismo diseño que ya usa el equipo en
 * el GastroCore real (ficha tipo "ticket" de una sola preparación, pensada
 * para imprimirse en cocina: encabezado con nombre/familia/sede/fecha,
 * cuatro indicadores arriba, tabla de ingredientes y el costo total de la
 * preparación). No recalcula nada — recibe los mismos números que ya
 * calculó `/recetas/[id]` con las funciones de `lib/costeo.ts`.
 */
export async function generarPdfReceta(datos: {
  receta: RecetaDatos;
  ingredientes: IngredienteLinea[];
  resumen: ResumenCosteo | null;
  costoTotalPreparacion: number;
}): Promise<Uint8Array> {
  const { receta, ingredientes, resumen, costoTotalPreparacion } = datos;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const fecha = new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
  const paginas: PDFPage[] = [];

  let page = pdf.addPage([ANCHO, ALTO]);
  paginas.push(page);
  let y = 0;

  function texto(
    t: string,
    x: number,
    yy: number,
    opts?: { size?: number; bold?: boolean; color?: RGB; derecha?: boolean; centro?: boolean; ancho?: number }
  ) {
    const size = opts?.size ?? 9;
    const f: PDFFont = opts?.bold ? fontBold : font;
    let xx = x;
    if (opts?.derecha && opts.ancho !== undefined) {
      xx = x + opts.ancho - f.widthOfTextAtSize(t, size);
    } else if (opts?.centro && opts.ancho !== undefined) {
      xx = x + (opts.ancho - f.widthOfTextAtSize(t, size)) / 2;
    }
    page.drawText(t, { x: xx, y: yy, size, font: f, color: opts?.color ?? NEGRO });
  }

  function rect(x: number, yy: number, w: number, h: number, opts: { fill?: RGB; stroke?: RGB; strokeW?: number }) {
    page.drawRectangle({
      x,
      y: yy,
      width: w,
      height: h,
      color: opts.fill,
      borderColor: opts.stroke,
      borderWidth: opts.stroke ? opts.strokeW ?? 0.6 : undefined,
    });
  }

  function dibujarEncabezado(completo: boolean) {
    const alturaBanda = completo ? 86 : 50;
    rect(0, ALTO - alturaBanda, ANCHO, alturaBanda, { fill: AZUL });
    rect(0, ALTO - alturaBanda - 3, ANCHO, 3, { fill: AZUL_CLARO });

    texto(receta.nombre.toUpperCase(), MARGEN, ALTO - 34, { size: 17, bold: true, color: BLANCO });
    if (completo) {
      const tipoLinea = `${(receta.familia_nombre ?? "GENERAL").toUpperCase()}  ·  RECETA`;
      texto(tipoLinea, MARGEN, ALTO - 52, { size: 9, color: rgb(0.82, 0.87, 0.93) });
    }

    const sede = receta.sede_nombre ?? "";
    const wSede = fontBold.widthOfTextAtSize(sede, 10);
    page.drawText(sede, { x: ANCHO - MARGEN - wSede, y: ALTO - 24, size: 10, font: fontBold, color: BLANCO });
    const wFecha = font.widthOfTextAtSize(fecha, 8);
    page.drawText(fecha, { x: ANCHO - MARGEN - wFecha, y: ALTO - 37, size: 8, color: rgb(0.82, 0.87, 0.93), font });

    y = ALTO - alturaBanda - 3 - (completo ? 30 : 20);
  }

  function dibujarTarjetas() {
    const gap = 10;
    const anchoTarjeta = (ANCHO_UTIL - gap * 3) / 4;
    const alturaTarjeta = 42;
    const tarjetas: [string, string][] = [
      ["Porciones", String(receta.rendimiento ?? "—")],
      ["Costo del plato", money(receta.costo_porcion)],
      ["Precio real", receta.precio_real ? money(receta.precio_real) : "Sin precio"],
      ["Food cost", resumen ? `${(resumen.foodCost * 100).toFixed(1)}%` : "—"],
    ];
    tarjetas.forEach(([label, valor], idx) => {
      const x = MARGEN + idx * (anchoTarjeta + gap);
      rect(x, y - alturaTarjeta, anchoTarjeta, alturaTarjeta, { fill: rgb(0.975, 0.98, 0.985), stroke: GRIS_CLARO, strokeW: 0.6 });
      texto(label.toUpperCase(), x + 10, y - 16, { size: 7, color: GRIS });
      texto(valor, x + 10, y - 32, { size: 12.5, bold: true, color: AZUL });
    });
    y -= alturaTarjeta + 22;
  }

  function dibujarEncabezadoTabla() {
    rect(MARGEN, y - ALTO_HEADER_TABLA, ANCHO_UTIL, ALTO_HEADER_TABLA, { fill: AZUL });
    let x = MARGEN;
    for (const col of COLUMNAS) {
      texto(col.titulo, x + (col.alinear === "der" ? -6 : 8), y - 15, {
        size: 8,
        bold: true,
        color: BLANCO,
        derecha: col.alinear === "der",
        ancho: col.alinear === "der" ? col.ancho : undefined,
      });
      x += col.ancho;
    }
    y -= ALTO_HEADER_TABLA;
  }

  function nuevaPagina(conEncabezadoCompleto: boolean) {
    page = pdf.addPage([ANCHO, ALTO]);
    paginas.push(page);
    dibujarEncabezado(conEncabezadoCompleto);
    if (!conEncabezadoCompleto) y -= 4;
    dibujarEncabezadoTabla();
  }

  // --- Contenido ---
  dibujarEncabezado(true);
  dibujarTarjetas();
  dibujarEncabezadoTabla();

  if (ingredientes.length === 0) {
    texto("Todavía no tiene ingredientes.", MARGEN + 8, y - 14, { size: 9, color: GRIS });
    y -= ALTO_FILA_TABLA;
  }

  ingredientes.forEach((ing, idx) => {
    if (y - ALTO_FILA_TABLA < 90) {
      nuevaPagina(false);
    }
    if (idx % 2 === 0) {
      rect(MARGEN, y - ALTO_FILA_TABLA, ANCHO_UTIL, ALTO_FILA_TABLA, { fill: FILA_PAR });
    }

    const cantReal = ing.cantidad / (1 - Math.min(ing.merma_pct, 0.949));
    const filaValores = [
      ing.descripcion.length > 32 ? ing.descripcion.slice(0, 31) + "…" : ing.descripcion,
      ing.tipo_item === "subreceta" ? "Subreceta" : "Insumo",
      formatCantidad(ing.cantidad),
      ing.unidad_codigo ?? "—",
      ing.merma_pct > 0 ? `${Math.round(ing.merma_pct * 100)}%` : "—",
      formatCantidad(cantReal),
      money(ing.costo_unitario),
      money(ing.costo_linea),
    ];

    let x = MARGEN;
    filaValores.forEach((valor, i) => {
      const col = COLUMNAS[i];
      texto(valor, x + (col.alinear === "der" ? -6 : 8), y - 13, {
        size: 8.5,
        derecha: col.alinear === "der",
        ancho: col.alinear === "der" ? col.ancho : undefined,
      });
      x += col.ancho;
    });
    y -= ALTO_FILA_TABLA;
  });

  if (y - 26 < 60) {
    nuevaPagina(false);
  }
  y -= 8;
  page.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: 0.7, color: GRIS_CLARO });
  y -= 18;
  const totalTexto = "COSTO TOTAL DE LA PREPARACIÓN";
  const totalValor = money(costoTotalPreparacion);
  texto(totalTexto, MARGEN, y, { size: 9.5, bold: true, color: NEGRO });
  const wTotal = fontBold.widthOfTextAtSize(totalValor, 10.5);
  page.drawText(totalValor, { x: ANCHO - MARGEN - wTotal, y, size: 10.5, font: fontBold, color: AZUL });

  // Pie de página (se agrega al final, ya con el total de páginas conocido)
  const totalPaginas = paginas.length;
  const sedeTexto = `${receta.sede_nombre ?? "Gastro Central"} · Recetario interno — GastroCore`;
  paginas.forEach((p, idx) => {
    p.drawLine({ start: { x: MARGEN, y: 44 }, end: { x: ANCHO - MARGEN, y: 44 }, thickness: 0.5, color: GRIS_CLARO });
    p.drawText(sedeTexto, { x: MARGEN, y: 32, size: 7.5, font, color: GRIS });
    const txtPagina = `Página ${idx + 1} de ${totalPaginas}`;
    const wPagina = font.widthOfTextAtSize(txtPagina, 7.5);
    p.drawText(txtPagina, { x: ANCHO - MARGEN - wPagina, y: 32, size: 7.5, font, color: GRIS });
  });

  return pdf.save();
}
