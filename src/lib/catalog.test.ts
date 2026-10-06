// @vitest-environment node
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedCatalog } from "../../prisma/seed";
import { getProductDetailBySlug, listCatalogProducts } from "./catalog";

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

describe("getProductDetailBySlug", () => {
  it("devuelve la ficha de camiseta-basica con sus campos y 4 variantes", async () => {
    const product = await getProductDetailBySlug("camiseta-basica", prisma);

    expect(product).not.toBeNull();
    expect(product?.name).toBe("Camiseta básica");
    expect(product?.description).toBe(
      "Camiseta de algodón de corte recto, cómoda para el día a día.",
    );
    expect(product?.categoryName).toBe("Camisetas");
    expect(product?.priceCents).toBe(1999);
    expect(product?.currency).toBe("EUR");
    expect(product?.imageUrl).toBe("/images/products/camiseta-basica.svg");
    expect(product?.variants).toHaveLength(4);

    const variante = product?.variants.find(
      (variant) => variant.sku === "camiseta-basica-S-negro",
    );
    expect(variante).toMatchObject({
      size: "S",
      color: "negro",
      stock: 12,
      priceCents: 1999,
    });
  });

  it("incluye la variante agotada de camiseta-estampada (S/negro, stock 0)", async () => {
    const product = await getProductDetailBySlug("camiseta-estampada", prisma);

    const agotada = product?.variants.find(
      (variant) => variant.sku === "camiseta-estampada-S-negro",
    );
    expect(agotada).toMatchObject({ size: "S", color: "negro", stock: 0 });
  });

  it("devuelve null para un slug inexistente", async () => {
    await expect(getProductDetailBySlug("no-existe", prisma)).resolves.toBeNull();
  });
});
