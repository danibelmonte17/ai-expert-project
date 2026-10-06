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

/** Variante comprable: pareja talla/color con su stock y precio propios. */
export interface ProductVariant {
  id: string;
  size: string;
  color: string;
  sku: string;
  stock: number;
  priceCents: number;
}

/** Ficha de producto: campos de presentacion + matriz real de variantes. */
export interface CatalogProductDetail {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  priceCents: number;
  currency: string;
  categoryName: string;
  variants: ProductVariant[];
}

/**
 * Devuelve la ficha completa de un producto por slug, o `null` si no existe
 * (la pagina lo traduce a `notFound()`).
 *
 * El cliente Prisma es inyectable (mismo patron que `listCatalogProducts`) para
 * testear contra una base temporal. La UI nunca ve modelos de Prisma.
 */
export async function getProductDetailBySlug(
  slug: string,
  prisma: PrismaClient = db,
): Promise<CatalogProductDetail | null> {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
    },
  });

  if (!product) {
    return null;
  }

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    priceCents: product.priceCents,
    currency: product.currency,
    categoryName: product.category.name,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      size: variant.size,
      color: variant.color,
      sku: variant.sku,
      stock: variant.stock,
      priceCents: variant.priceCents,
    })),
  };
}
