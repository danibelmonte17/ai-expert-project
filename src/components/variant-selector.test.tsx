import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductVariant } from "@/lib/catalog";
import { colorsIn, sizesIn } from "@/lib/variants";
import { VariantSelector } from "./variant-selector";

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

const basica: ProductVariant[] = [
  variant("S", "negro", 12),
  variant("M", "blanco", 10),
  variant("L", "azul", 8),
  variant("XL", "rojo", 6),
];

const estampada: ProductVariant[] = [
  variant("S", "negro", 0),
  variant("M", "blanco", 7),
  variant("L", "rojo", 5),
];

function noop() {}

describe("VariantSelector", () => {
  it("renderiza los grupos de talla y color con sus chips", () => {
    render(
      <VariantSelector
        variants={basica}
        sizes={sizesIn(basica)}
        colors={colorsIn(basica)}
        onSelectSize={noop}
        onSelectColor={noop}
      />,
    );

    expect(screen.getByRole("group", { name: "Talla" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Color" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "S" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "XL" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "negro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "rojo" })).toBeInTheDocument();
  });

  it("marca con aria-pressed el chip seleccionado", () => {
    render(
      <VariantSelector
        variants={basica}
        sizes={sizesIn(basica)}
        colors={colorsIn(basica)}
        selectedSize="M"
        selectedColor="azul"
        onSelectSize={noop}
        onSelectColor={noop}
      />,
    );

    expect(screen.getByRole("button", { name: "M" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "S" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("deshabilita las combinaciones inexistentes con el otro eje fijado", () => {
    render(
      <VariantSelector
        variants={basica}
        sizes={sizesIn(basica)}
        colors={colorsIn(basica)}
        selectedSize="S"
        onSelectSize={noop}
        onSelectColor={noop}
      />,
    );

    expect(screen.getByRole("button", { name: "negro" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "blanco" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "azul" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "rojo" })).toBeDisabled();
  });

  it("marca un chip agotado pero lo deja seleccionable", () => {
    render(
      <VariantSelector
        variants={estampada}
        sizes={sizesIn(estampada)}
        colors={colorsIn(estampada)}
        onSelectSize={noop}
        onSelectColor={noop}
      />,
    );

    const chip = screen.getByRole("button", { name: "S" });
    expect(chip).toHaveAttribute("data-sold-out", "true");
    expect(chip).toBeEnabled();
  });

  it("invoca los callbacks al pulsar un chip", () => {
    const onSelectSize = vi.fn();
    const onSelectColor = vi.fn();

    render(
      <VariantSelector
        variants={basica}
        sizes={sizesIn(basica)}
        colors={colorsIn(basica)}
        onSelectSize={onSelectSize}
        onSelectColor={onSelectColor}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "M" }));
    expect(onSelectSize).toHaveBeenCalledWith("M");

    fireEvent.click(screen.getByRole("button", { name: "azul" }));
    expect(onSelectColor).toHaveBeenCalledWith("azul");
  });
});
