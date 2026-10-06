import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CatalogProductDetail, ProductVariant } from "@/lib/catalog";
import { ProductDetail } from "./product-detail";

// Vitest (sin `globals: true`) no activa la limpieza automatica de Testing Library.
afterEach(() => cleanup());

function variant(size: string, color: string, stock: number): ProductVariant {
  return {
    id: `${size}-${color}`,
    size,
    color,
    sku: `producto-${size}-${color}`,
    stock,
    priceCents: 1999,
  };
}

const basica: CatalogProductDetail = {
  id: "id-camiseta-basica",
  slug: "camiseta-basica",
  name: "Camiseta básica",
  description: "Camiseta de algodón de corte recto, cómoda para el día a día.",
  imageUrl: "/images/products/camiseta-basica.svg",
  priceCents: 1999,
  currency: "EUR",
  categoryName: "Camisetas",
  variants: [
    variant("S", "negro", 12),
    variant("M", "blanco", 10),
    variant("L", "azul", 8),
    variant("XL", "rojo", 6),
  ],
};

const estampada: CatalogProductDetail = {
  id: "id-camiseta-estampada",
  slug: "camiseta-estampada",
  name: "Camiseta estampada",
  description: "Camiseta con estampado gráfico y tacto suave.",
  imageUrl: "/images/products/camiseta-estampada.svg",
  priceCents: 2499,
  currency: "EUR",
  categoryName: "Camisetas",
  variants: [variant("S", "negro", 0), variant("M", "blanco", 7), variant("L", "rojo", 5)],
};

function cta() {
  return screen.getByRole("button", { name: "Añadir al carrito" });
}

function clickChip(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("ProductDetail", () => {
  it("muestra imagen, nombre, categoria, descripcion y precio", () => {
    render(<ProductDetail product={basica} />);

    expect(screen.getByRole("img", { name: "Camiseta básica" })).toHaveAttribute(
      "src",
      "/images/products/camiseta-basica.svg",
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Camiseta básica",
    );
    expect(screen.getByText("Camisetas")).toBeInTheDocument();
    expect(screen.getByText(/Camiseta de algodón/)).toBeInTheDocument();
    expect(screen.getByText(/19,99/)).toBeInTheDocument();
  });

  it("sin seleccion muestra el hint y deja el CTA deshabilitado", () => {
    render(<ProductDetail product={basica} />);

    expect(
      screen.getByText("Selecciona talla y color para ver el stock."),
    ).toBeInTheDocument();
    expect(cta()).toBeDisabled();
  });

  it("al elegir S/negro muestra Disponible con su stock y habilita el CTA", () => {
    render(<ProductDetail product={basica} />);

    clickChip("S");
    clickChip("negro");

    expect(screen.getByText("Disponible")).toBeInTheDocument();
    expect(screen.getByText("12 en stock")).toBeInTheDocument();
    expect(cta()).toBeEnabled();
  });

  it("una variante agotada se muestra como Agotada y no habilita el CTA", () => {
    render(<ProductDetail product={estampada} />);

    clickChip("S");
    clickChip("negro");

    expect(screen.getByText("Agotada")).toBeInTheDocument();
    expect(cta()).toBeDisabled();
  });

  it("deshabilita el otro eje en las combinaciones que no existen", () => {
    render(<ProductDetail product={basica} />);

    // Con talla S fijada, blanco/azul/rojo no tienen variante (matriz sparse).
    clickChip("S");

    expect(screen.getByRole("button", { name: "negro" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "blanco" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "azul" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "rojo" })).toBeDisabled();
    expect(
      screen.getByText("Selecciona talla y color para ver el stock."),
    ).toBeInTheDocument();
  });

  it("sin variantes muestra la nota y deja el CTA deshabilitado", () => {
    render(<ProductDetail product={{ ...basica, variants: [] }} />);

    expect(
      screen.getByText("Este producto no tiene variantes disponibles."),
    ).toBeInTheDocument();
    expect(cta()).toBeDisabled();
  });
});
