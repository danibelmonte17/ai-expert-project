import type { ProductVariant } from "./catalog";

/**
 * Logica pura de la matriz de variantes (product-detail).
 *
 * El seed guarda una matriz **sparse**: no existen todas las combinaciones
 * talla x color (p. ej. `camiseta-basica` no tiene S/blanco). Estos helpers
 * resuelven el estado y la seleccion sin tocar el DOM ni Prisma, de modo que
 * los componentes quedan finos y la matriz se testea aislada.
 */

/** Estado derivado de una variante segun su stock (`docs/domain-model.md`). */
export type VariantState = "Disponible" | "Agotada";

/** Orden canonico de tallas y colores para presentarlos de forma estable. */
const SIZE_ORDER = ["S", "M", "L", "XL"] as const;
const COLOR_ORDER = ["negro", "blanco", "azul", "rojo"] as const;

/** `Disponible` con stock > 0; `Agotada` con stock = 0. */
export function variantState(stock: number): VariantState {
  return stock > 0 ? "Disponible" : "Agotada";
}

/** Variante exacta para una pareja talla/color, o `undefined` si no existe. */
export function resolveVariant(
  variants: ProductVariant[],
  size: string,
  color: string,
): ProductVariant | undefined {
  return variants.find(
    (variant) => variant.size === size && variant.color === color,
  );
}

/** Tallas presentes en la matriz, en orden canonico (S, M, L, XL). */
export function sizesIn(variants: ProductVariant[]): string[] {
  const present = new Set(variants.map((variant) => variant.size));
  return SIZE_ORDER.filter((size) => present.has(size));
}

/** Colores presentes en la matriz, en orden canonico (negro, blanco, azul, rojo). */
export function colorsIn(variants: ProductVariant[]): string[] {
  const present = new Set(variants.map((variant) => variant.color));
  return COLOR_ORDER.filter((color) => present.has(color));
}

/**
 * `true` si existe al menos una variante compatible con la seleccion parcial
 * mas el valor candidato. Un valor no selectable (sin combinacion) debe
 * renderizarse `disabled`; asi nunca se resuelve una variante inexistente.
 */
export function isSelectable(
  variants: ProductVariant[],
  size?: string,
  color?: string,
): boolean {
  return variants.some(
    (variant) =>
      (size === undefined || variant.size === size) &&
      (color === undefined || variant.color === color),
  );
}

/**
 * `true` si todas las variantes compatibles con la seleccion tienen stock 0
 * (chip marcado como agotado). Si no hay ninguna compatible devuelve `false`:
 * eso se trata como combinacion inexistente, no como agotada.
 */
export function isSoldOutOption(
  variants: ProductVariant[],
  size?: string,
  color?: string,
): boolean {
  const matching = variants.filter(
    (variant) =>
      (size === undefined || variant.size === size) &&
      (color === undefined || variant.color === color),
  );

  return matching.length > 0 && matching.every((variant) => variant.stock === 0);
}

/** Seleccion de variante en curso (los ejes pueden estar aun sin fijar). */
export interface VariantSelection {
  size?: string;
  color?: string;
}

/**
 * Devuelve la seleccion resultante de fijar `axis = value`, limpiando el otro
 * eje si la combinacion pasa a no existir en la matriz sparse. Es la regla de
 * limpieza (4c) aislada y testeable sin DOM.
 */
export function nextSelection(
  variants: ProductVariant[],
  current: VariantSelection,
  axis: "size" | "color",
  value: string,
): VariantSelection {
  const next: VariantSelection = { ...current, [axis]: value };

  if (
    next.size &&
    next.color &&
    !resolveVariant(variants, next.size, next.color)
  ) {
    if (axis === "size") {
      next.color = undefined;
    } else {
      next.size = undefined;
    }
  }

  return next;
}
