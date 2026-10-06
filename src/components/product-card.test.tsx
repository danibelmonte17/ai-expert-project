import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CatalogProduct } from "@/lib/catalog";
import { ProductCard } from "./product-card";

// Vitest (sin `globals: true`) no activa la limpieza automatica de Testing Library.
afterEach(() => cleanup());

const product: CatalogProduct = {
  id: "id-camiseta-basica",
  slug: "camiseta-basica",
  name: "Camiseta básica",
  imageUrl: "/images/products/camiseta-basica.svg",
  priceCents: 1999,
  currency: "EUR",
  categoryName: "Camisetas",
};

describe("ProductCard", () => {
  it("muestra imagen con alt, nombre, categoria y precio formateado", () => {
    render(<ProductCard product={product} />);

    const image = screen.getByRole("img", { name: "Camiseta básica" });
    expect(image).toHaveAttribute("src", "/images/products/camiseta-basica.svg");
    expect(screen.getByText("Camiseta básica")).toBeInTheDocument();
    expect(screen.getByText("Camisetas")).toBeInTheDocument();
    expect(screen.getByText(/19,99/)).toBeInTheDocument();
  });

  it("enlaza la tarjeta a la ficha del producto", () => {
    render(<ProductCard product={product} />);

    const link = screen.getByRole("link", { name: /Camiseta básica/ });
    expect(link).toHaveAttribute("href", "/productos/camiseta-basica");
  });
});
