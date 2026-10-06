import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CatalogProduct } from "@/lib/catalog";
import Home from "./page";

// Vitest (sin `globals: true`) no activa la limpieza automatica de Testing Library.
afterEach(() => cleanup());

vi.mock("@/lib/catalog", () => ({
  listCatalogProducts: vi.fn(),
}));

import { listCatalogProducts } from "@/lib/catalog";

const mockedListCatalogProducts = vi.mocked(listCatalogProducts);

const product: CatalogProduct = {
  id: "id-camiseta-basica",
  slug: "camiseta-basica",
  name: "Camiseta básica",
  imageUrl: "/images/products/camiseta-basica.svg",
  priceCents: 1999,
  currency: "EUR",
  categoryName: "Camisetas",
};

describe("Home (catalogo)", () => {
  it("renderiza el listado con los productos devueltos", async () => {
    mockedListCatalogProducts.mockResolvedValue([product]);

    render(await Home());

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Catálogo");
    expect(screen.getByText("Camiseta básica")).toBeInTheDocument();
    expect(screen.getByText("Camisetas")).toBeInTheDocument();
    expect(screen.getByText(/19,99/)).toBeInTheDocument();
  });

  it("muestra el estado vacio cuando no hay productos", async () => {
    mockedListCatalogProducts.mockResolvedValue([]);

    render(await Home());

    expect(screen.getByText("No hay productos disponibles.")).toBeInTheDocument();
  });
});
