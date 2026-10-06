/**
 * Formato de presentacion (catalog-list).
 *
 * El dominio guarda dinero en centavos (`priceCents`); la UI lo formatea aqui.
 * `Intl` puede emitir un espacio fino (NBSP/NNBSP) antes del simbolo "€", por lo
 * que no se debe comparar el resultado con una cadena con espacio normal.
 */
export function formatPrice(priceCents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(priceCents / 100);
}
