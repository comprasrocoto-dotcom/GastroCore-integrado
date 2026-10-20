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
 */

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
    nombre: "Rocoto clásico",
    descripcion: "Rojo rocoto con acentos naranja — el clásico de la casa.",
    bannerDesde: "#B91C1C",
    bannerHasta: "#EA580C",
    bannerTexto: "#FFFFFF",
    acento: "#B91C1C",
    categorias: ["#B91C1C", "#EA580C", "#C2410C", "#991B1B", "#D97706", "#DC2626"],
  },
  {
    id: "malanga",
    nombre: "Malanga tropical",
    descripcion: "Verdes tropicales, fresco y natural.",
    bannerDesde: "#15803D",
    bannerHasta: "#65A30D",
    bannerTexto: "#FFFFFF",
    acento: "#15803D",
    categorias: ["#15803D", "#65A30D", "#0D9488", "#4D7C0F", "#166534", "#059669"],
  },
  {
    id: "pacifico",
    nombre: "Pacífico",
    descripcion: "Azules de mar, tranquilo y profesional.",
    bannerDesde: "#0C4A6E",
    bannerHasta: "#0891B2",
    bannerTexto: "#FFFFFF",
    acento: "#0369A1",
    categorias: ["#0369A1", "#0891B2", "#0C4A6E", "#155E75", "#2563EB", "#0E7490"],
  },
  {
    id: "aji-amarillo",
    nombre: "Ají amarillo",
    descripcion: "Amarillo y naranja, cálido y llamativo.",
    bannerDesde: "#B45309",
    bannerHasta: "#EAB308",
    bannerTexto: "#1F2937",
    acento: "#B45309",
    categorias: ["#B45309", "#D97706", "#CA8A04", "#A16207", "#EA580C", "#854D0E"],
  },
  {
    id: "carbon",
    nombre: "Carbón elegante",
    descripcion: "Gris carbón y negro, sobrio y elegante.",
    bannerDesde: "#18181B",
    bannerHasta: "#3F3F46",
    bannerTexto: "#FFFFFF",
    acento: "#27272A",
    categorias: ["#27272A", "#52525B", "#71717A", "#3F3F46", "#18181B", "#A1A1AA"],
  },
  {
    id: "vino",
    nombre: "Vino tinto",
    descripcion: "Vino y borgoña, cálido y señorial.",
    bannerDesde: "#4C0519",
    bannerHasta: "#9F1239",
    bannerTexto: "#FFFFFF",
    acento: "#7F1D1D",
    categorias: ["#7F1D1D", "#9F1239", "#881337", "#4C0519", "#BE123C", "#9A3412"],
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
