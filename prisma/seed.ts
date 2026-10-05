import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Seed idempotente del catalogo de ejemplo (bootstrap-seed).
 *
 * - Idempotente: usa upserts por claves estables (`Category.slug`, `Product.slug`,
 *   `Variant.sku`); re-ejecutarlo no crea duplicados.
 * - No siembra `User`, `Cart`, `CartItem`, `Order`, `OrderLine`, `Chat` ni
 *   `TryonImage`: esas tablas quedan vacias (se materializan en features de checkout).
 * - Autoverificacion: si no se cumplen los minimos, la funcion lanza un error y el
 *   CLI termina con exit code != 0.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Conteos resumidos del catalogo sembrado. */
export interface CatalogSummary {
  categories: number;
  products: number;
  variants: number;
  sizes: number;
  colors: number;
  minPriceCents: number;
  maxPriceCents: number;
  soldOutVariants: number;
  fullyStockedProducts: number;
}

interface CategorySeed {
  slug: string;
  name: string;
}

interface VariantSeed {
  size: "S" | "M" | "L" | "XL";
  color: "negro" | "blanco" | "azul" | "rojo";
  stock: number;
}

interface ProductSeed {
  slug: string;
  name: string;
  description: string;
  categorySlug: string;
  priceCents: number;
  variants: VariantSeed[];
}

const CATEGORIES: CategorySeed[] = [
  { slug: "camisetas", name: "Camisetas" },
  { slug: "pantalones", name: "Pantalones" },
  { slug: "abrigos", name: "Abrigos" },
];

/** Ordenado de mas nuevo a mas antiguo: `createdAt` se escalona ~1 producto/semana. */
const PRODUCTS: ProductSeed[] = [
  {
    slug: "camiseta-basica",
    name: "Camiseta básica",
    description: "Camiseta de algodón de corte recto, cómoda para el día a día.",
    categorySlug: "camisetas",
    priceCents: 1999,
    variants: [
      { size: "S", color: "negro", stock: 12 },
      { size: "M", color: "blanco", stock: 10 },
      { size: "L", color: "azul", stock: 8 },
      { size: "XL", color: "rojo", stock: 6 },
    ],
  },
  {
    slug: "camiseta-estampada",
    name: "Camiseta estampada",
    description: "Camiseta con estampado gráfico y tacto suave.",
    categorySlug: "camisetas",
    priceCents: 2499,
    variants: [
      { size: "S", color: "negro", stock: 0 },
      { size: "M", color: "blanco", stock: 7 },
      { size: "L", color: "rojo", stock: 5 },
    ],
  },
  {
    slug: "camiseta-manga-larga",
    name: "Camiseta manga larga",
    description: "Camiseta de manga larga en algodón peinado.",
    categorySlug: "camisetas",
    priceCents: 2799,
    variants: [
      { size: "S", color: "azul", stock: 9 },
      { size: "M", color: "negro", stock: 11 },
      { size: "L", color: "blanco", stock: 4 },
    ],
  },
  {
    slug: "pantalon-chino",
    name: "Pantalón chino",
    description: "Pantalón chino de tejido resistente y caída recta.",
    categorySlug: "pantalones",
    priceCents: 4999,
    variants: [
      { size: "S", color: "negro", stock: 6 },
      { size: "M", color: "azul", stock: 8 },
      { size: "L", color: "blanco", stock: 5 },
      { size: "XL", color: "negro", stock: 3 },
    ],
  },
  {
    slug: "pantalon-vaquero",
    name: "Pantalón vaquero",
    description: "Vaquero de denim clásico con cinco bolsillos.",
    categorySlug: "pantalones",
    priceCents: 5999,
    variants: [
      { size: "S", color: "azul", stock: 7 },
      { size: "M", color: "azul", stock: 0 },
      { size: "L", color: "negro", stock: 9 },
      { size: "XL", color: "azul", stock: 4 },
    ],
  },
  {
    slug: "pantalon-deportivo",
    name: "Pantalón deportivo",
    description: "Pantalón deportivo elástico y transpirable.",
    categorySlug: "pantalones",
    priceCents: 3999,
    variants: [
      { size: "M", color: "negro", stock: 13 },
      { size: "L", color: "rojo", stock: 10 },
      { size: "XL", color: "blanco", stock: 6 },
    ],
  },
  {
    slug: "abrigo-ligero",
    name: "Abrigo ligero",
    description: "Abrigo ligero para entretiempo, con cierre frontal.",
    categorySlug: "abrigos",
    priceCents: 8999,
    variants: [
      { size: "S", color: "negro", stock: 8 },
      { size: "M", color: "azul", stock: 6 },
      { size: "L", color: "blanco", stock: 5 },
      { size: "XL", color: "negro", stock: 4 },
    ],
  },
  {
    slug: "abrigo-invierno",
    name: "Abrigo de invierno",
    description: "Abrigo de invierno abrigado con forro interior.",
    categorySlug: "abrigos",
    priceCents: 11999,
    variants: [
      { size: "S", color: "azul", stock: 5 },
      { size: "M", color: "negro", stock: 4 },
      { size: "L", color: "rojo", stock: 3 },
      { size: "XL", color: "blanco", stock: 2 },
    ],
  },
];

const MIN_CATEGORIES = 3;
const MIN_PRODUCTS = 8;
const MIN_VARIANTS = 24;
const MAX_VARIANTS = 30;
const REQUIRED_SIZES = 4;
const REQUIRED_COLORS = 4;
const MIN_PRICE_CENTS = 1999;
const MAX_PRICE_CENTS = 11999;
const MIN_SOLD_OUT = 2;
const MIN_FULLY_STOCKED_PRODUCTS = 2;

/** Aplica el catalogo de ejemplo y devuelve el resumen autoverificado. */
export async function seedCatalog(prisma: PrismaClient): Promise<CatalogSummary> {
  const now = Date.now();

  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: { slug: category.slug, name: category.name },
    });
  }

  for (let index = 0; index < PRODUCTS.length; index += 1) {
    const seed = PRODUCTS[index];
    const category = await prisma.category.findUniqueOrThrow({
      where: { slug: seed.categorySlug },
    });
    const imageUrl = `/images/products/${seed.slug}.svg`;
    const createdAt = new Date(now - index * WEEK_MS);

    const product = await prisma.product.upsert({
      where: { slug: seed.slug },
      update: {
        name: seed.name,
        description: seed.description,
        imageUrl,
        priceCents: seed.priceCents,
        currency: "EUR",
        categoryId: category.id,
      },
      create: {
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        imageUrl,
        priceCents: seed.priceCents,
        currency: "EUR",
        categoryId: category.id,
        createdAt,
      },
    });

    for (const variant of seed.variants) {
      const sku = `${seed.slug}-${variant.size}-${variant.color}`;
      await prisma.variant.upsert({
        where: { sku },
        update: {
          productId: product.id,
          size: variant.size,
          color: variant.color,
          stock: variant.stock,
          priceCents: seed.priceCents,
        },
        create: {
          sku,
          productId: product.id,
          size: variant.size,
          color: variant.color,
          stock: variant.stock,
          priceCents: seed.priceCents,
        },
      });
    }
  }

  const [
    categories,
    products,
    variants,
    soldOutVariants,
    sizes,
    colors,
    priceRange,
    stockByProduct,
  ] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.variant.count(),
    prisma.variant.count({ where: { stock: 0 } }),
    prisma.variant.findMany({ select: { size: true }, distinct: ["size"] }),
    prisma.variant.findMany({ select: { color: true }, distinct: ["color"] }),
    prisma.product.aggregate({
      _min: { priceCents: true },
      _max: { priceCents: true },
    }),
    prisma.variant.groupBy({ by: ["productId"], _min: { stock: true } }),
  ]);

  const minPriceCents = priceRange._min.priceCents ?? 0;
  const maxPriceCents = priceRange._max.priceCents ?? 0;
  const fullyStockedProducts = stockByProduct.filter(
    (group) => (group._min.stock ?? 0) > 0,
  ).length;

  const summary: CatalogSummary = {
    categories,
    products,
    variants,
    sizes: sizes.length,
    colors: colors.length,
    minPriceCents,
    maxPriceCents,
    soldOutVariants,
    fullyStockedProducts,
  };

  assertMinimums(summary);
  return summary;
}

/** Falla con un mensaje claro si el catalogo no cumple los minimos del spec. */
function assertMinimums(summary: CatalogSummary): void {
  const problems: string[] = [];

  if (summary.categories !== MIN_CATEGORIES) {
    problems.push(`categorías esperadas ${MIN_CATEGORIES}, encontradas ${summary.categories}`);
  }
  if (summary.products !== MIN_PRODUCTS) {
    problems.push(`productos esperados ${MIN_PRODUCTS}, encontrados ${summary.products}`);
  }
  if (summary.variants < MIN_VARIANTS || summary.variants > MAX_VARIANTS) {
    problems.push(`variantes esperadas ${MIN_VARIANTS}-${MAX_VARIANTS}, encontradas ${summary.variants}`);
  }
  if (summary.sizes !== REQUIRED_SIZES) {
    problems.push(`tallas esperadas ${REQUIRED_SIZES}, encontradas ${summary.sizes}`);
  }
  if (summary.colors < REQUIRED_COLORS) {
    problems.push(`colores esperados >= ${REQUIRED_COLORS}, encontrados ${summary.colors}`);
  }
  if (summary.minPriceCents !== MIN_PRICE_CENTS || summary.maxPriceCents !== MAX_PRICE_CENTS) {
    problems.push(
      `rango de precios esperado ${MIN_PRICE_CENTS}-${MAX_PRICE_CENTS} centavos, encontrado ${summary.minPriceCents}-${summary.maxPriceCents}`,
    );
  }
  if (summary.soldOutVariants < MIN_SOLD_OUT) {
    problems.push(`variantes agotadas esperadas >= ${MIN_SOLD_OUT}, encontradas ${summary.soldOutVariants}`);
  }
  if (summary.fullyStockedProducts < MIN_FULLY_STOCKED_PRODUCTS) {
    problems.push(
      `productos 100% en stock esperados >= ${MIN_FULLY_STOCKED_PRODUCTS}, encontrados ${summary.fullyStockedProducts}`,
    );
  }

  if (problems.length > 0) {
    throw new Error(`El catálogo sembrado no cumple los mínimos:\n- ${problems.join("\n- ")}`);
  }
}

/**
 * Carga `.env` en `process.env` antes de crear el cliente.
 *
 * `@prisma/client` no lee `.env` de forma fiable en runtime (el auto-load se
 * resuelve al generar el cliente), asi que el CLI del seed lo carga de forma
 * explicita. Es nativo de Node (>=20.12) y no anade dependencias.
 */
function loadEnvFileIfPresent(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

async function main(): Promise<void> {
  loadEnvFileIfPresent();
  const prisma = new PrismaClient();
  try {
    const summary = await seedCatalog(prisma);
    console.log("Seed de catálogo completado:");
    console.log(`  Categorías: ${summary.categories}`);
    console.log(`  Productos: ${summary.products}`);
    console.log(`  Variantes: ${summary.variants}`);
    console.log(`  Tallas: ${summary.sizes} / Colores: ${summary.colors}`);
    console.log(`  Precios: ${summary.minPriceCents}-${summary.maxPriceCents} centavos`);
    console.log(`  Variantes agotadas (stock 0): ${summary.soldOutVariants}`);
    console.log(`  Productos 100% en stock: ${summary.fullyStockedProducts}`);
  } finally {
    await prisma.$disconnect();
  }
}

function isCliInvocation(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return entry.replace(/\\/g, "/").endsWith("prisma/seed.ts");
}

if (isCliInvocation()) {
  main().catch((error: unknown) => {
    console.error("Error al sembrar el catálogo:", error);
    process.exitCode = 1;
  });
}
