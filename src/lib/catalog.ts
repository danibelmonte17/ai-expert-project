import type { PrismaClient } from "@prisma/client";
import { db } from "./db";

/** Producto del listado: solo los campos que necesita la vista del catalogo. */
export interface CatalogProduct {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  priceCents: number;
  currency: string;
  categoryName: string;
}

/**
 * Devuelve los productos del catalogo ordenados por novedad (createdAt desc).
 *
 * El cliente Prisma es inyectable para poder testear contra una base temporal
 * sin depender del singleton `db`.
 */
export async function listCatalogProducts(
  prisma: PrismaClient = db,
): Promise<CatalogProduct[]> {
  const products = await prisma.product.findMany({
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  return products.map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    imageUrl: product.imageUrl,
    priceCents: product.priceCents,
    currency: product.currency,
    categoryName: product.category.name,
  }));
}
