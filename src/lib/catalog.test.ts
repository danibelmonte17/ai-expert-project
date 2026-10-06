// @vitest-environment node
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedCatalog } from "../../prisma/seed";
import { listCatalogProducts } from "./catalog";

/**
 * Test de integracion del listado de catalogo (catalog-list).
 *
 * Aplica las migraciones sobre una base temporal (`prisma/test-catalog.db`,
 * cubierta por `.gitignore`) y verifica que `listCatalogProducts` devuelve los
 * productos del seed con sus campos, su categoria y el orden por novedad.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const prismaDir = path.join(repoRoot, "prisma");
const testDatabaseUrl = "file:./test-catalog.db";

const TEST_DB_FILES = [
  "test-catalog.db",
  "test-catalog.db-journal",
  "test-catalog.db-wal",
  "test-catalog.db-shm",
];

function removeTestDatabase(): void {
  for (const file of TEST_DB_FILES) {
    rmSync(path.join(prismaDir, file), { force: true });
  }
}

let prisma: PrismaClient;

beforeAll(async () => {
  removeTestDatabase();

  execSync("pnpm exec prisma migrate deploy", {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "pipe",
  });

  process.env.DATABASE_URL = testDatabaseUrl;
  prisma = new PrismaClient();
  await seedCatalog(prisma);
}, 120_000);

afterAll(async () => {
  await prisma?.$disconnect();
  removeTestDatabase();
});

describe("listCatalogProducts", () => {
  it("devuelve los 8 productos del seed con los campos del catalogo", async () => {
    const products = await listCatalogProducts(prisma);

    expect(products).toHaveLength(8);
    for (const product of products) {
      expect(product.id).toBeTruthy();
      expect(product.slug).toBeTruthy();
      expect(product.name).toBeTruthy();
      expect(product.imageUrl).toMatch(/^\/images\/products\/.+\.svg$/);
      expect(product.priceCents).toBeGreaterThan(0);
      expect(product.currency).toBe("EUR");
      expect(product.categoryName).toBeTruthy();
    }
  });

  it("ordena por createdAt descendente (novedad primero)", async () => {
    const products = await listCatalogProducts(prisma);

    expect(products[0].slug).toBe("camiseta-basica");
    expect(products[products.length - 1].slug).toBe("abrigo-invierno");
  });

  it("resuelve el nombre de la categoria de cada producto", async () => {
    const products = await listCatalogProducts(prisma);
    const basica = products.find((product) => product.slug === "camiseta-basica");

    expect(basica?.categoryName).toBe("Camisetas");
  });
});
