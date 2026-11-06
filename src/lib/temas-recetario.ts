/**
 * Los 6 estilos de color para el Recetario (pantalla `/recetario`) y,
 * si alcanza, para la franja superior del PDF de receta — lo mismo que
 * pedía Mariluz del sistema viejo ("Estilo del recetario"), adaptado:
 * acá no hay plantilla de Google Sheets que copiar, así que cada estilo
 * es simplemente un juego de colores (banner + acentos de categoría) que
 * se guarda como texto en `configuracion` (clave "identidad") y no
 * requiere ninguna migración de base de datos.
 *
 * Cada sede elige su estilo en Configuración; no cambia ninguna fórmula
 * ni ningún dato, solo el color con el que se ve su Recetario.
 *
 * Colores reales (06/11): Mariluz mandó la paleta de 6 colores pastel
 * que reemplaza los colores provisionales que había antes (pidió
 * "poné la paleta en la web, y yo la elijo según necesidad" — o sea, no
 * es un color fijo por marca, sigue siendo ella la que elige el estilo
 * por sede, como ya funcionaba). Cada uno de los 6 estilos ahora usa uno
 * de sus colores reales como color principal (banner y acento), y los 6
 * estilos comparten la misma paleta completa de 6 colores para pintar
 * las categorías/familias del Recetario — así, elija el estilo que elija
 * cada sede, las tarjetas de distintas familias siempre se distinguen
 * con los 6 colores reales de la marca, no con colores inventados.
 */

const PALETA_REAL = ["#B2D6C0", "#8EBDB8", "#929EB7", "#F5C9CF", "#FADBD2", "#FFF5E0"];
const TEXTO_SOBRE_PASTEL = "#1F2937";

export type TemaRecetario = {
  id: string;
  nombre: string;
  descripcion: string;
  /** Extremos del degradé de la franja superior (banner). */
  bannerDesde: string;
  bannerHasta: string;
  /** Color de texto sobre el banner (casi siempre blanco). */
  bannerTexto: string;
  /** Color sólido principal — botones activos, bordes, y la franja del PDF. */
  acento: string;
  /** Paleta para pintar las categorías del Recetario, una por familia (se repite en ciclo si hay más familias que colores). */
  categorias: string[];
};

export const TEMAS_RECETARIO: TemaRecetario[] = [
  {
    id: "rocoto",
    nombre: "Verde salvia",
    descripcion: "Verde salvia suave, el primero de la paleta real.",
    bannerDesde: PALETA_REAL[0],
    bannerHasta: PALETA_REAL[0],
    bannerTexto: TEXTO_SOBRE_PASTEL,
    acento: PALETA_REAL[0],
    categorias: PALETA_REAL,
  },
  {
    id: "malanga",
    nombre: "Verde azulado",
    descripcion: "Verde azulado, el segundo de la paleta real.",
    bannerDesde: PALETA_REAL[1],
    bannerHasta: PALETA_REAL[1],
    bannerTexto: TEXTO_SOBRE_PASTEL,
    acento: PALETA_REAL[1],
    categorias: PALETA_REAL,
  },
  {
    id: "pacifico",
    nombre: "Azul grisáceo",
    descripcion: "Azul grisáceo, el tercero de la paleta real.",
    bannerDesde: PALETA_REAL[2],
    bannerHasta: PALETA_REAL[2],
    bannerTexto: TEXTO_SOBRE_PASTEL,
    acento: PALETA_REAL[2],
    categorias: PALETA_REAL,
  },
  {
    id: "aji-amarillo",
    nombre: "Rosa",
    descripcion: "Rosa suave, el cuarto de la paleta real.",
    bannerDesde: PALETA_REAL[3],
    bannerHasta: PALETA_REAL[3],
    bannerTexto: TEXTO_SOBRE_PASTEL,
    acento: PALETA_REAL[3],
    categorias: PALETA_REAL,
  },
  {
    id: "carbon",
    nombre: "Durazno",
    descripcion: "Durazno suave, el quinto de la paleta real.",
    bannerDesde: PALETA_REAL[4],
    bannerHasta: PALETA_REAL[4],
    bannerTexto: TEXTO_SOBRE_PASTEL,
    acento: PALETA_REAL[4],
    categorias: PALETA_REAL,
  },
  {
    id: "vino",
    nombre: "Crema",
    descripcion: "Crema suave, el sexto de la paleta real.",
    bannerDesde: PALETA_REAL[5],
    bannerHasta: PALETA_REAL[5],
    bannerTexto: TEXTO_SOBRE_PASTEL,
    acento: PALETA_REAL[5],
    categorias: PALETA_REAL,
  },
];

export const TEMA_DEFECTO = "rocoto";

export function obtenerTema(id: string | null | undefined): TemaRecetario {
  return TEMAS_RECETARIO.find((t) => t.id === id) ?? TEMAS_RECETARIO[0];
}

/** Color de categoría por índice, cicla si hay más categorías que colores. */
export function colorCategoria(tema: TemaRecetario, indice: number): string {
  return tema.categorias[indice % tema.categorias.length];
}

/** "#RRGGBB" → [r, g, b] en 0–1, para pasarle el color a pdf-lib (rgb()). */
export function hexARgb01(hex: string): [number, number, number] {
  const limpio = hex.replace("#", "");
  const r = parseInt(limpio.substring(0, 2), 16) / 255;
  const g = parseInt(limpio.substring(2, 4), 16) / 255;
  const b = parseInt(limpio.substring(4, 6), 16) / 255;
  return [r, g, b];
}
