// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ProductVariant } from "./catalog";
import {
  colorsIn,
  isSelectable,
  isSoldOutOption,
  nextSelection,
  resolveVariant,
  sizesIn,
  variantState,
} from "./variants";

/**
 * Tests unitarios de la matriz de variantes (product-detail).
 *
 * Usan fixtures con la misma forma sparse que el seed: `camiseta-basica` no
 * tiene S/blanco y `camiseta-estampada` tiene S/negro agotada (stock 0).
 */

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

describe("variantState", () => {
  it("devuelve Agotada con stock 0 y Disponible con stock > 0", () => {
    expect(variantState(0)).toBe("Agotada");
    expect(variantState(12)).toBe("Disponible");
  });
});

describe("resolveVariant", () => {
  it("devuelve la variante exacta de una pareja talla/color", () => {
    const resolved = resolveVariant(basica, "S", "negro");

    expect(resolved?.sku).toBe("producto-S-negro");
    expect(resolved?.stock).toBe(12);
  });

  it("devuelve undefined para una combinacion inexistente (matriz sparse)", () => {
    expect(resolveVariant(basica, "S", "blanco")).toBeUndefined();
  });
});

describe("sizesIn / colorsIn", () => {
  it("devuelve solo los valores presentes en orden canonico", () => {
    expect(sizesIn(basica)).toEqual(["S", "M", "L", "XL"]);
    expect(colorsIn(basica)).toEqual(["negro", "blanco", "azul", "rojo"]);
    expect(sizesIn(estampada)).toEqual(["S", "M", "L"]);
    expect(colorsIn(estampada)).toEqual(["negro", "blanco", "rojo"]);
  });
});

describe("isSelectable", () => {
  it("acepta una combinacion existente", () => {
    expect(isSelectable(basica, "S", "negro")).toBe(true);
  });

  it("rechaza una combinacion inexistente (S/blanco en camiseta-basica)", () => {
    expect(isSelectable(basica, "S", "blanco")).toBe(false);
  });

  it("acepta un valor con combinaciones libres cuando el otro eje no esta fijado", () => {
    expect(isSelectable(basica, "S", undefined)).toBe(true);
    expect(isSelectable(basica, undefined, "blanco")).toBe(true);
  });
});

describe("isSoldOutOption", () => {
  it("marca agotada una combinacion cuyo unico stock es 0", () => {
    expect(isSoldOutOption(estampada, "S", "negro")).toBe(true);
  });

  it("no marca agotada una combinacion inexistente", () => {
    expect(isSoldOutOption(estampada, "S", "blanco")).toBe(false);
  });

  it("no marca agotada una combinacion con stock", () => {
    expect(isSoldOutOption(basica, "S", "negro")).toBe(false);
  });
});

describe("nextSelection", () => {
  it("mantiene la seleccion cuando la combinacion existe", () => {
    expect(nextSelection(basica, { size: "M" }, "color", "blanco")).toEqual({
      size: "M",
      color: "blanco",
    });
  });

  it("limpia el otro eje cuando la combinacion resultante no existe", () => {
    // Cambiar color a blanco con talla S fijada: S/blanco no existe.
    expect(nextSelection(basica, { size: "S" }, "color", "blanco")).toEqual({
      color: "blanco",
    });
    // Cambiar talla a S con color blanco fijado: S/blanco no existe.
    expect(nextSelection(basica, { color: "blanco" }, "size", "S")).toEqual({
      size: "S",
    });
  });

  it("no limpia nada si el otro eje aun no estaba fijado", () => {
    expect(nextSelection(basica, {}, "size", "S")).toEqual({ size: "S" });
  });
});
