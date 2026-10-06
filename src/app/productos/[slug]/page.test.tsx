import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CatalogProductDetail, ProductVariant } from "@/lib/catalog";
import ProductPage from "./page";

// Vitest (sin `globals: true`) no activa la limpieza automatica de Testing Library.
afterEach(() => cleanup());

vi.mock("@/lib/catalog", () => ({
  getProductDetailBySlug: vi.fn(),
}));

// Se conservan los exports reales (next/link importa de next/navigation) y solo
// se sustituye `notFound`, que en Next lanza para renderizar la pagina 404.
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    notFound: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
  };
});

import { getProductDetailBySlug } from "@/lib/catalog";

const mockedGetProductDetailBySlug = vi.mocked(getProductDetailBySlug);

function variant(size: string, color: string, stock: number): ProductVariant {
  return {
    id: `${size}-${color}`,
    size,
    color,
    sku: `camiseta-basica-${size}-${color}`,
    stock,
    priceCents: 1999,
  };
}

const product: CatalogProductDetail = {
  id: "id-camiseta-basica",
  slug: "camiseta-basica",
  name: "Camiseta básica",
  description: "Camiseta de algodón de corte recto, cómoda para el día a día.",
  imageUrl: "/images/products/camiseta-basica.svg",
  priceCents: 1999,
  currency: "EUR",
  categoryName: "Camisetas",
  variants: [variant("S", "negro", 12)],
};

function params(slug: string) {
  return Promise.resolve({ slug });
}

describe("ProductPage", () => {
  it("renderiza la ficha del producto resuelto por slug", async () => {
    mockedGetProductDetailBySlug.mockResolvedValue(product);

    render(await ProductPage({ params: params("camiseta-basica") }));

    expect(mockedGetProductDetailBySlug).toHaveBeenCalledWith("camiseta-basica");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Camiseta básica",
    );
    expect(screen.getByText("Camisetas")).toBeInTheDocument();
  });

  it("invoca notFound cuando el slug no existe", async () => {
    mockedGetProductDetailBySlug.mockResolvedValue(null);

    await expect(
      ProductPage({ params: params("no-existe") }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
