import { prisma } from "./db";

/**
 * Datos de un producto que necesita el listado del catalogo (`catalog-list`).
 * Deliberadamente minimo: no expone campos internos ni variantes. La navegacion
 * (enlaces, detalle, filtros u ordenacion) es alcance de features siguientes.
 */
export interface CatalogProduct {
  slug: string;
  name: string;
  imageUrl: string;
  priceCents: number;
  currency: string;
  category: {
    slug: string;
    name: string;
  };
  createdAt: Date;
}

/**
 * Devuelve el catalogo completo ordenado por novedad (mas nuevo primero).
 *
 * Orden por defecto determinista y estable (coherente con el `createdAt`
 * escalonado del seed); la ordenacion elegida por el usuario llegara con
 * `catalog-sort`. Sin filtros, paginacion ni mutaciones.
 */
export async function getCatalogProducts(): Promise<CatalogProduct[]> {
  return prisma.product.findMany({
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });
}
