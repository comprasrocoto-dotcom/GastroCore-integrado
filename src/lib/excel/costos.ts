import ExcelJS from "exceljs";

/**
 * Lector del archivo plano de costos que sube Mariluz desde "Insumos →
 * Cargar costos desde archivo" (06/11). Formato real confirmado con un
 * archivo de ejemplo de Rocoto (`Base_de_Costos.xlsx`): una sola hoja,
 * columnas en este orden — Cód. Barras, Artículo, Subartículo (en la
 * práctica es la UNIDAD escrita en palabras, no un subartículo de
 * verdad), Subfamilia, Coste.
 *
 * Este archivo solo lee y normaliza filas — no toca la base de datos.
 * El cruce contra los insumos existentes vive en
 * `@/lib/data/importar-costos.ts` (necesita Supabase, así que es
 * server-only; esto de acá es una función pura para poder probarla
 * fácil y para que un día pueda leer también un .csv sin cambiar nada
 * del cruce).
 */

export type FilaArchivoCosto = {
  codigo: string | null;
  articulo: string;
  unidadPalabra: string | null;
  unidadCodigo: string | null;
  subfamiliaNombre: string | null;
  coste: number;
  esSubreceta: boolean;
};

/**
 * Tabla de Windows-1252 para los bytes 0x80-0x9F (la única franja donde
 * cp1252 no coincide con Latin-1) — ej. el byte 0x91 es '‘' (comilla
 * simple izquierda), no el carácter de control que sería en Latin-1
 * puro. Se usa al revés (Unicode → byte) en `arreglarMojibake`.
 */
const CP1252_0x80_0x9F: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

/**
 * Varios archivos de proveedores (confirmado con el de Rocoto) tienen las
 * tildes y la Ñ corrompidas porque en algún punto de su historia el texto
 * se codificó dos veces: UTF-8 primero, y esos bytes se volvieron a
 * guardar como si fueran Windows-1252 en vez de UTF-8 ("AÃ‘OS" en vez de
 * "AÑOS"). Revertir ese mismo paso (volver a convertir cada carácter a su
 * byte de Windows-1252, y decodificar esos bytes como UTF-8) recupera el
 * texto original. Si el texto ya estaba bien, el round-trip simplemente
 * falla (no da una secuencia UTF-8 válida) y se deja el texto tal cual —
 * no hace nada raro con un archivo que no tiene el problema.
 */
export function arreglarMojibake(texto: string): string {
  try {
    const bytes = new Uint8Array(texto.length);
    for (let i = 0; i < texto.length; i++) {
      const codigo = texto.charCodeAt(i);
      if (codigo <= 0xff) {
        bytes[i] = codigo; // 0x00-0x7F y 0xA0-0xFF: igual que Latin-1
      } else {
        const byteCp1252 = CP1252_0x80_0x9F[codigo];
        if (byteCp1252 === undefined) return texto; // no es un caso de este bug conocido
        bytes[i] = byteCp1252;
      }
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return texto;
  }
}

/** Palabra de unidad (como la escribe el archivo) → código real de `unidades_medida`. */
const MAPA_UNIDADES: Record<string, string> = {
  GRAMOS: "GR",
  UNIDADES: "UND",
  ONZA: "OZ",
  COPA: "COPA",
};

function normalizarTexto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  return texto.length > 0 ? texto : null;
}

export async function leerFilasArchivoCosto(
  buffer: ArrayBuffer
): Promise<FilaArchivoCosto[]> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  const hoja = libro.worksheets[0];
  if (!hoja) return [];

  const filas: FilaArchivoCosto[] = [];

  hoja.eachRow((fila, numeroFila) => {
    if (numeroFila === 1) return; // encabezado

    const codigoCrudo = fila.getCell(1).value;
    const codigo = normalizarTexto(codigoCrudo);
    const articuloCrudo = normalizarTexto(fila.getCell(2).value);
    const unidadPalabraCrudo = normalizarTexto(fila.getCell(3).value);
    const subfamiliaCrudo = normalizarTexto(fila.getCell(4).value);
    const costeCrudo = fila.getCell(5).value;

    if (!articuloCrudo) return; // fila vacía o de relleno

    const articulo = arreglarMojibake(articuloCrudo);
    const unidadPalabra = unidadPalabraCrudo
      ? arreglarMojibake(unidadPalabraCrudo)
      : null;
    const subfamiliaNombre = subfamiliaCrudo
      ? arreglarMojibake(subfamiliaCrudo)
      : null;
    const coste = typeof costeCrudo === "number" ? costeCrudo : Number(costeCrudo ?? 0);

    filas.push({
      codigo,
      articulo,
      unidadPalabra,
      unidadCodigo: unidadPalabra ? MAPA_UNIDADES[unidadPalabra.toUpperCase()] ?? null : null,
      subfamiliaNombre,
      coste: Number.isFinite(coste) ? coste : 0,
      esSubreceta: (codigo ?? "").toUpperCase().startsWith("SUB"),
    });
  });

  return filas;
}
