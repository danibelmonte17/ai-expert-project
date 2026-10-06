import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CatalogProduct } from "@/lib/catalog";
import { ProductGrid } from "./product-grid";

// Vitest (sin `globals: true`) no activa la limpieza automatica de Testing Library.
afterEach(() => cleanup());

function buildProduct(index: number): CatalogProduct {
  return {
    id: `id-${index}`,
    slug: `producto-${index}`,
    name: `Producto ${index}`,
    imageUrl: `/images/products/producto-${index}.svg`,
    priceCents: 1000 + index,
    currency: "EUR",
    categoryName: "Camisetas",
  };
}

describe("ProductGrid", () => {
  it("muestra el titulo y una tarjeta por producto", () => {
    const products = [buildProduct(1), buildProduct(2), buildProduct(3)];

    render(<ProductGrid products={products} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Catálogo");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Producto 1")).toBeInTheDocument();
    expect(screen.getByText("Producto 3")).toBeInTheDocument();
  });

  it("muestra el estado vacio cuando no hay productos", () => {
    render(<ProductGrid products={[]} />);

    expect(screen.getByText("No hay productos disponibles.")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
