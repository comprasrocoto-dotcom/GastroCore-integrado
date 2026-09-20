import { PDFDocument, StandardFonts, rgb, type RGB } from "pdf-lib";

type IngredienteLinea = {
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
  rendimiento: number | null;
  unidad_rendimiento_codigo: string | null;
  costo_total: number;
  costo_porcion: number;
  precio_real: number | null;
  desvio_pct: number;
};

type ResumenCosteo = {
  precioSugerido: number;
  utilidad: number;
  foodCost: number;
  margenBruto: number;
};

const ANCHO = 595.28; // A4
const ALTO = 841.89;
const MARGEN = 40;

const money = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-CO");

/**
 * Arma el PDF de una receta con los mismos datos que se ven en
 * `/recetas/[id]`: info general, tarjetas de costo/precio, tabla de
 * ingredientes y resumen de costos. No inventa ni recalcula nada — recibe
 * los mismos números que ya calculó la página (mismas funciones de
 * `lib/costeo.ts`).
 */
export async function generarPdfReceta(datos: {
  receta: RecetaDatos;
  ingredientes: IngredienteLinea[];
  resumen: ResumenCosteo | null;
  costoBaseSinMerma: number;
  costoPorMerma: number;
  desvioMonto: number;
  foodCostObjetivo: number;
}): Promise<Uint8Array> {
  const { receta, ingredientes, resumen, costoBaseSinMerma, costoPorMerma, desvioMonto, foodCostObjetivo } =
    datos;

  const pdf = await PDFDocument.create();
  let page = pdf.addPage([ANCHO, ALTO]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const azul: RGB = rgb(0.118, 0.227, 0.373); // #1E3A5F
  const gris: RGB = rgb(0.4, 0.44, 0.5);
  const negro: RGB = rgb(0.1, 0.1, 0.12);
  const lineaClara: RGB = rgb(0.85, 0.86, 0.88);

  function texto(t: string, x: number, yy: number, opts?: { size?: number; bold?: boolean; color?: RGB }) {
    page.drawText(t, {
      x,
      y: yy,
      size: opts?.size ?? 10,
      font: opts?.bold ? fontBold : font,
      color: opts?.color ?? negro,
    });
  }

  function linea(yy: number) {
    page.drawLine({ start: { x: MARGEN, y: yy }, end: { x: ANCHO - MARGEN, y: yy }, thickness: 0.5, color: lineaClara });
  }

  function nuevaPaginaSiHaceFalta(alturaNecesaria: number) {
    if (y - alturaNecesaria < 60) {
      page = pdf.addPage([ANCHO, ALTO]);
      y = 800;
    }
  }

  // Encabezado
  texto("GASTRO CENTRAL", MARGEN, y, { size: 9, bold: true, color: gris });
  y -= 22;
  texto(receta.nombre, MARGEN, y, { size: 18, bold: true, color: azul });
  y -= 18;
  texto(
    `Familia: ${receta.familia_nombre ?? "General"}   ·   Rendimiento: ${receta.rendimiento ?? "—"} ${
      receta.unidad_rendimiento_codigo ?? ""
    }`,
    MARGEN,
    y,
    { size: 10, color: gris }
  );
  y -= 26;

  // Tarjetas de costos
  const tarjetas: [string, string][] = [
    ["Costo del plato", money(receta.costo_porcion)],
    ["Precio sugerido", resumen ? money(resumen.precioSugerido) : "—"],
    ["Precio real", receta.precio_real ? money(receta.precio_real) : "Sin precio"],
    ["Utilidad", resumen ? money(resumen.utilidad) : "—"],
  ];
  const anchoTarjeta = (ANCHO - MARGEN * 2) / 4;
  tarjetas.forEach(([label, valor], idx) => {
    const x = MARGEN + idx * anchoTarjeta;
    texto(label.toUpperCase(), x, y, { size: 7, color: gris });
    texto(valor, x, y - 14, { size: 12, bold: true, color: azul });
  });
  y -= 40;

  linea(y);
  y -= 20;

  // Tabla de ingredientes
  texto(`Ingredientes (${ingredientes.length})`, MARGEN, y, { size: 11, bold: true });
  y -= 16;

  const columnas = [
    { titulo: "Insumo", x: MARGEN },
    { titulo: "Unidad", x: MARGEN + 190 },
    { titulo: "Cant.", x: MARGEN + 245 },
    { titulo: "Merma%", x: MARGEN + 300 },
    { titulo: "Costo unit.", x: MARGEN + 355 },
    { titulo: "Costo total", x: MARGEN + 435 },
  ];

  columnas.forEach((c) => texto(c.titulo, c.x, y, { size: 8, bold: true, color: gris }));
  y -= 4;
  linea(y);
  y -= 14;

  if (ingredientes.length === 0) {
    texto("Todavía no tiene ingredientes.", MARGEN, y, { size: 9, color: gris });
    y -= 16;
  }

  for (const ing of ingredientes) {
    nuevaPaginaSiHaceFalta(20);
    texto(ing.descripcion.slice(0, 42), columnas[0].x, y, { size: 9 });
    texto(ing.unidad_codigo ?? "—", columnas[1].x, y, { size: 9 });
    texto(String(ing.cantidad), columnas[2].x, y, { size: 9 });
    texto(`${(ing.merma_pct * 100).toFixed(1)}%`, columnas[3].x, y, { size: 9 });
    texto(money(ing.costo_unitario), columnas[4].x, y, { size: 9 });
    texto(money(ing.costo_linea), columnas[5].x, y, { size: 9 });
    y -= 16;
  }

  y -= 10;
  nuevaPaginaSiHaceFalta(180);
  linea(y);
  y -= 20;

  // Resumen de costos
  texto("Resumen de costos", MARGEN, y, { size: 11, bold: true });
  y -= 18;

  const filasResumen: [string, string][] = [
    ["Costo de ingredientes", money(costoBaseSinMerma)],
    ["Costo por merma", money(costoPorMerma)],
    ["Desvío de mercancía", `${(receta.desvio_pct * 100).toFixed(1)}% · ${money(desvioMonto)}`],
    ["Costo total del plato", money(receta.costo_total)],
    ["Costo por porción", money(receta.costo_porcion)],
    ["Food cost objetivo", `${(foodCostObjetivo * 100).toFixed(0)}%`],
  ];
  if (resumen) {
    filasResumen.push(
      ["Precio sugerido", money(resumen.precioSugerido)],
      ["Food cost real", `${(resumen.foodCost * 100).toFixed(2)}%`],
      ["Utilidad", money(resumen.utilidad)],
      ["Margen bruto", `${(resumen.margenBruto * 100).toFixed(2)}%`]
    );
  }

  filasResumen.forEach(([label, valor]) => {
    nuevaPaginaSiHaceFalta(16);
    texto(label, MARGEN, y, { size: 9, color: gris });
    texto(valor, MARGEN + 250, y, { size: 9, bold: true });
    y -= 15;
  });

  texto(`Generado el ${new Date().toLocaleString("es-CO")}`, MARGEN, 40, { size: 7, color: gris });

  return pdf.save();
}
