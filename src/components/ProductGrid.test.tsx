import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CatalogProduct } from "../lib/catalog";
import { ProductGrid } from "./ProductGrid";

// Vitest no expone `afterEach` global (globals: false); registramos la limpieza
// del DOM entre tests para evitar que el render de un test se filtre al siguiente.
afterEach(() => {
  cleanup();
});

const PRODUCTS: CatalogProduct[] = [
  {
    slug: "camiseta-basica",
    name: "Camiseta básica",
    imageUrl: "/images/products/camiseta-basica.svg",
    priceCents: 1999,
    currency: "EUR",
    category: { slug: "camisetas", name: "Camisetas" },
    createdAt: new Date("2026-10-05T00:00:00.000Z"),
  },
  {
    slug: "abrigo-invierno",
    name: "Abrigo de invierno",
    imageUrl: "/images/products/abrigo-invierno.svg",
    priceCents: 11999,
    currency: "EUR",
    category: { slug: "abrigos", name: "Abrigos" },
    createdAt: new Date("2026-08-10T00:00:00.000Z"),
  },
];

describe("ProductGrid", () => {
  it("renderiza una tarjeta por producto con imagen, nombre, categoria y precio", () => {
    render(<ProductGrid products={PRODUCTS} />);

    const cards = screen.getAllByRole("listitem");
    expect(cards).toHaveLength(PRODUCTS.length);

    const first = within(cards[0]);
    expect(first.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Camiseta básica",
    );
    expect(first.getByText("Camisetas")).toBeInTheDocument();
    expect(first.getByText("19,99 €")).toBeInTheDocument();
    expect(first.getByAltText("Camiseta básica")).toBeInTheDocument();

    const second = within(cards[1]);
    expect(second.getByText("Abrigos")).toBeInTheDocument();
    expect(second.getByText("119,99 €")).toBeInTheDocument();
  });

  it("muestra un estado vacio amigable cuando no hay productos", () => {
    render(<ProductGrid products={[]} />);

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(
      screen.getByText("No hay productos disponibles en este momento."),
    ).toBeInTheDocument();
  });
});
