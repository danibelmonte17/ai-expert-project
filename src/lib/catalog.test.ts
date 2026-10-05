// @vitest-environment node
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedCatalog } from "../../prisma/seed";

/**
 * Test de integracion de la consulta del catalogo (catalog-list).
 *
 * Aplica las migraciones sobre una base temporal (`prisma/test-catalog.db`,
 * cubierta por `.gitignore`), la siembra con `seedCatalog` y verifica la forma,
 * los campos y el orden por novedad que `getCatalogProducts` entrega a la UI.
 *
 * Los modulos de la capa de datos se cargan de forma dinamica DESPUES de fijar
 * `DATABASE_URL`: el singleton de Prisma resuelve la URL al importarse.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const testDatabaseUrl = "file:./test-catalog.db";

const TEST_DB_FILES = [
  "test-catalog.db",
  "test-catalog.db-journal",
  "test-catalog.db-wal",
  "test-catalog.db-shm",
];

function removeTestDatabase(): void {
  for (const file of TEST_DB_FILES) {
    rmSync(path.join(repoRoot, "prisma", file), { force: true });
  }
}

let getCatalogProducts: (typeof import("./catalog"))["getCatalogProducts"];
let prisma: PrismaClient;

beforeAll(async () => {
  removeTestDatabase();

  execSync("pnpm exec prisma migrate deploy", {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "pipe",
  });

  process.env.DATABASE_URL = testDatabaseUrl;
  const catalogModule = await import("./catalog");
  const dbModule = await import("./db");
  getCatalogProducts = catalogModule.getCatalogProducts;
  prisma = dbModule.prisma;

  await seedCatalog(prisma);
}, 120_000);

afterAll(async () => {
  await prisma?.$disconnect();
  removeTestDatabase();
});

describe("getCatalogProducts", () => {
  it("devuelve los 8 productos del seed con nombre, imagen, categoria y precio", async () => {
    const products = await getCatalogProducts();

    expect(products).toHaveLength(8);

    const categoryNames = new Set(["Camisetas", "Pantalones", "Abrigos"]);
    for (const product of products) {
      expect(product.name.length).toBeGreaterThan(0);
      expect(product.imageUrl).toMatch(/^\/images\/products\/.+\.svg$/);
      expect(categoryNames.has(product.category.name)).toBe(true);
      expect(product.priceCents).toBeGreaterThanOrEqual(1999);
      expect(product.priceCents).toBeLessThanOrEqual(11999);
      expect(product.currency).toBe("EUR");
      expect(product.createdAt).toBeInstanceOf(Date);
    }
  });

  it("ordena por novedad (createdAt descendente)", async () => {
    const products = await getCatalogProducts();
    const timestamps = products.map((product) => product.createdAt.getTime());
    const sorted = [...timestamps].sort((a, b) => b - a);

    expect(timestamps).toEqual(sorted);
    expect(products[0].slug).toBe("camiseta-basica");
  });

  it("expone la categoria con su slug y nombre", async () => {
    const products = await getCatalogProducts();
    const basica = products.find((product) => product.slug === "camiseta-basica");

    expect(basica).toBeDefined();
    expect(basica?.name).toBe("Camiseta básica");
    expect(basica?.priceCents).toBe(1999);
    expect(basica?.category.slug).toBe("camisetas");
    expect(basica?.category.name).toBe("Camisetas");
  });
});
