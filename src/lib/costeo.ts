/**
 * Módulo único de costeo — todas las pantallas que muestren food cost,
 * precio sugerido, utilidad, margen o semáforo deben usar estas funciones,
 * nunca reimplementar la cuenta en el componente. Así se evita que dos
 * pantallas calculen el mismo número de formas distintas.
 *
 * Fórmulas y valores fijos: copiados tal cual del GastroCore actual (ver
 * docs/prompt-maestro-hermes-fase-2-lanzar-app.md, sección 2). No cambia
 * nada de la lógica de negocio.
 *
 * Importante: `recetas` no guarda food_cost/precio_sugerido/margen como
 * columnas — se calculan al vuelo con estas funciones a partir de
 * costo_porcion + precio_real + iva, para que nunca queden desactualizados
 * si cambia el costo de un insumo.
 */

/** Impuesto al consumo (fijo). */
export const INC = 0.08;

/** Food cost objetivo (fijo) para el precio sugerido normal. */
export const FC_OBJ = 0.35;

/** Food cost objetivo (fijo) solo para la sugerencia del Panel Ejecutivo. */
export const FC_OBJ_PANEL = 0.3;

/** Umbrales del semáforo de food cost. */
export const SEMAFORO_VERDE_MAX = 0.33;
export const SEMAFORO_AMARILLO_MAX = 0.35;

export type Semaforo = "verde" | "amarillo" | "rojo";

/** Precio real sin el impuesto al consumo incluido. */
export function precioBaseSinImpuesto(precioReal: number): number {
  return precioReal / (1 + INC);
}

/** Food cost = costo de la porción / precio base sin impuesto. */
export function foodCost(costoPorcion: number, precioReal: number): number {
  const base = precioBaseSinImpuesto(precioReal);
  if (base <= 0) return 0;
  return costoPorcion / base;
}

/** Precio sugerido para alcanzar el food cost objetivo normal (35%). */
export function precioSugerido(costoPorcion: number): number {
  return (costoPorcion / FC_OBJ) * (1 + INC);
}

/** Precio sugerido para el Panel Ejecutivo, con food cost objetivo de 30%. */
export function precioSugeridoPanel(costoPorcion: number): number {
  return (costoPorcion / FC_OBJ_PANEL) * (1 + INC);
}

/** Utilidad en dinero = precio real - costo de la porción. */
export function utilidad(precioReal: number, costoPorcion: number): number {
  return precioReal - costoPorcion;
}

/** Margen bruto = utilidad / precio real, como fracción (0.42 = 42%). */
export function margenBruto(precioReal: number, costoPorcion: number): number {
  if (precioReal <= 0) return 0;
  return (precioReal - costoPorcion) / precioReal;
}

/** Semáforo de food cost: verde <= 33%, amarillo 33-35%, rojo > 35%. */
export function semaforoFoodCost(fc: number): Semaforo {
  if (fc <= SEMAFORO_VERDE_MAX) return "verde";
  if (fc <= SEMAFORO_AMARILLO_MAX) return "amarillo";
  return "rojo";
}

/**
 * Cantidad real a comprar/usar de un ingrediente, dado su merma.
 * La merma DIVIDE: cantidad real = cantidad ÷ (1 − merma%).
 * `merma` es una fracción (0.1 = 10%), no un porcentaje entero.
 */
export function cantidadConMerma(cantidad: number, merma: number): number {
  if (merma >= 1) return cantidad; // merma inválida, se evita división por 0/negativo
  return cantidad / (1 - merma);
}

/**
 * Costo de un ingrediente dentro de una receta, aplicando desvío.
 * El desvío MULTIPLICA el costo del ingrediente. `desvio` es una fracción
 * (0.05 = 5% de desvío → se multiplica por 1.05).
 */
export function costoConDesvio(costoBase: number, desvio: number): number {
  return costoBase * (1 + desvio);
}

export type ResumenCosteo = {
  costoPorcion: number;
  precioReal: number;
  foodCost: number;
  semaforo: Semaforo;
  precioSugerido: number;
  precioSugeridoPanel: number;
  utilidad: number;
  margenBruto: number;
};

/** Calcula de una sola vez todos los indicadores que se muestran en la UI. */
export function calcularResumenCosteo(
  costoPorcion: number,
  precioReal: number
): ResumenCosteo {
  const fc = foodCost(costoPorcion, precioReal);
  return {
    costoPorcion,
    precioReal,
    foodCost: fc,
    semaforo: semaforoFoodCost(fc),
    precioSugerido: precioSugerido(costoPorcion),
    precioSugeridoPanel: precioSugeridoPanel(costoPorcion),
    utilidad: utilidad(precioReal, costoPorcion),
    margenBruto: margenBruto(precioReal, costoPorcion),
  };
}
