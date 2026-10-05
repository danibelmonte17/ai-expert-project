/**
 * Formateo de dinero para la UI (unico punto de formateo, `catalog-list`).
 *
 * El modelo guarda el dinero SIEMPRE en centavos (`priceCents`); aqui se
 * convierte a unidades y se formatea en locale es-ES. No concatenar simbolos a
 * mano ni mutar el valor almacenado.
 */
export function formatPriceCents(priceCents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(priceCents / 100);
}
