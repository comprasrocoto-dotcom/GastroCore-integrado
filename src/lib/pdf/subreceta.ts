import { PDFDocument, StandardFonts, rgb, type RGB } from "pdf-lib";

type IngredienteLinea = {
  descripcion: string;
  unidad_codigo: string | null;
  cantidad: number;
  merma_pct: number;
  costo_unitario: number;
  costo_linea: number;
};

type SubrecetaDatos = {
  nombre: string;
  rendimiento: number | null;
  unidad_rendimiento_codigo: string | null;
  costo_total: number;
  costo_unitario: number;
};

const ANCHO = 595.28; // A4
const ALTO = 841.89;
const MARGEN = 40;

const money = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-CO");

/**
 * Arma el PDF de una subreceta con los mismos datos que se ven en
 * `/subrecetas/[id]`: info general, costo total/unitario y tabla de
 * ingredientes. No incluye precio de venta ni utilidad porque una
 * subreceta no se vende directamente.
 */
export async function generarPdfSubreceta(datos: {
  subreceta: SubrecetaDatos;
  ingredientes: IngredienteLinea[];
}): Promise<Uint8Array> {
  const { subreceta, ingredientes } = datos;

  const pdf = await PDFDocument.create();
  let page = pdf.addPage([ANCHO, ALTO]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const azul: RGB = rgb(0.118, 0.227, 0.373);
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

  texto("GASTRO CENTRAL · SUBRECETA", MARGEN, y, { size: 9, bold: true, color: gris });
  y -= 22;
  texto(subreceta.nombre, MARGEN, y, { size: 18, bold: true, color: azul });
  y -= 18;
  texto(`Rendimiento: ${subreceta.rendimiento ?? "—"} ${subreceta.unidad_rendimiento_codigo ?? ""}`, MARGEN, y, {
    size: 10,
    color: gris,
  });
  y -= 26;

  const tarjetas: [string, string][] = [
    ["Costo total", money(subreceta.costo_total)],
    ["Costo unitario", subreceta.costo_unitario.toFixed(4)],
  ];
  const anchoTarjeta = (ANCHO - MARGEN * 2) / 2;
  tarjetas.forEach(([label, valor], idx) => {
    const x = MARGEN + idx * anchoTarjeta;
    texto(label.toUpperCase(), x, y, { size: 7, color: gris });
    texto(valor, x, y - 14, { size: 12, bold: true, color: azul });
  });
  y -= 40;

  linea(y);
  y -= 20;

  texto(`Ingredientes (${ingredientes.length})`, MARGEN, y, { size: 11, bold: true });
  y -= 16;

  const columnas = [
    { titulo: "Ítem", x: MARGEN },
    { titulo: "Cant.", x: MARGEN + 200 },
    { titulo: "Unidad", x: MARGEN + 255 },
    { titulo: "Merma%", x: MARGEN + 310 },
    { titulo: "Costo unit.", x: MARGEN + 375 },
    { titulo: "Costo línea", x: MARGEN + 460 },
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
    texto(ing.descripcion.slice(0, 34), columnas[0].x, y, { size: 9 });
    texto(String(ing.cantidad), columnas[1].x, y, { size: 9 });
    texto(ing.unidad_codigo ?? "—", columnas[2].x, y, { size: 9 });
    texto(`${(ing.merma_pct * 100).toFixed(1)}%`, columnas[3].x, y, { size: 9 });
    texto(ing.costo_unitario.toFixed(4), columnas[4].x, y, { size: 9 });
    texto(money(ing.costo_linea), columnas[5].x, y, { size: 9 });
    y -= 16;
  }

  texto(`Generado el ${new Date().toLocaleString("es-CO")}`, MARGEN, 40, { size: 7, color: gris });

  return pdf.save();
}
