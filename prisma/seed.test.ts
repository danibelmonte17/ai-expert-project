// @vitest-environment node
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedCatalog, type CatalogSummary } from "./seed";

/**
 * Test de integracion del seed (bootstrap-seed).
 *
 * Aplica las migraciones sobre una base temporal (`prisma/test-seed.db`, cubierta
 * por `.gitignore`) y verifica: tablas consultables, conteos/dimensiones del
 * catalogo, estados de stock, imagenes locales y idempotencia.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const testDatabaseUrl = "file:./test-seed.db";

const TEST_DB_FILES = ["test-seed.db", "test-seed.db-journal", "test-seed.db-wal", "test-seed.db-shm"];

function removeTestDatabase(): void {
  for (const file of TEST_DB_FILES) {
    rmSync(path.join(here, file), { force: true });
  }
}

let prisma: PrismaClient;
let firstSummary: CatalogSummary;

beforeAll(async () => {
  removeTestDatabase();

  execSync("pnpm exec prisma migrate deploy", {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "pipe",
  });

  process.env.DATABASE_URL = testDatabaseUrl;
  prisma = new PrismaClient();
  firstSummary = await seedCatalog(prisma);
}, 120_000);

afterAll(async () => {
  await prisma?.$disconnect();
  removeTestDatabase();
});

describe("seed del catalogo", () => {
  it("crea y deja consultables las 10 tablas del dominio", async () => {
    const counts = await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.variant.count(),
      prisma.category.count(),
      prisma.cart.count(),
      prisma.cartItem.count(),
      prisma.order.count(),
      prisma.orderLine.count(),
      prisma.chat.count(),
      prisma.tryonImage.count(),
    ]);
    expect(counts).toHaveLength(10);
  });

  it("no siembra usuarios, carritos, pedidos, chats ni try-ons", async () => {
    const empty = await Promise.all([
      prisma.user.count(),
      prisma.cart.count(),
      prisma.cartItem.count(),
      prisma.order.count(),
      prisma.orderLine.count(),
      prisma.chat.count(),
      prisma.tryonImage.count(),
    ]);
    expect(empty).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("puebla el catalogo con conteos y dimensiones de filtro demostrables", () => {
    expect(firstSummary.categories).toBe(3);
    expect(firstSummary.products).toBe(8);
    expect(firstSummary.variants).toBeGreaterThanOrEqual(24);
    expect(firstSummary.variants).toBeLessThanOrEqual(30);
    expect(firstSummary.sizes).toBe(4);
    expect(firstSummary.colors).toBeGreaterThanOrEqual(4);
    expect(firstSummary.minPriceCents).toBe(1999);
    expect(firstSummary.maxPriceCents).toBe(11999);
  });

  it("incluye variantes agotadas y productos comprables de principio a fin", () => {
    expect(firstSummary.soldOutVariants).toBeGreaterThanOrEqual(2);
    expect(firstSummary.fullyStockedProducts).toBeGreaterThanOrEqual(2);
  });

  it("referencia placeholders de imagen locales y escalona createdAt", async () => {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
    });
    expect(products).toHaveLength(8);
    for (const product of products) {
      expect(product.imageUrl).toMatch(/^\/images\/products\/.+\.svg$/);
    }

    const distinctDays = new Set(
      products.map((product) => product.createdAt.toISOString().slice(0, 10)),
    );
    expect(distinctDays.size).toBeGreaterThanOrEqual(6);
  });

  it("es idempotente: re-ejecutar no cambia los conteos ni duplica SKUs", async () => {
    const secondSummary = await seedCatalog(prisma);

    expect(secondSummary.categories).toBe(firstSummary.categories);
    expect(secondSummary.products).toBe(firstSummary.products);
    expect(secondSummary.variants).toBe(firstSummary.variants);
    expect(secondSummary.soldOutVariants).toBe(firstSummary.soldOutVariants);
    expect(secondSummary.fullyStockedProducts).toBe(firstSummary.fullyStockedProducts);

    const skuCounts = await prisma.variant.groupBy({
      by: ["sku"],
      _count: { _all: true },
    });
    expect(skuCounts).toHaveLength(firstSummary.variants);
    expect(skuCounts.every((group) => group._count._all === 1)).toBe(true);
  });
});
