import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

vi.mock("../lib/catalog", () => ({
  getCatalogProducts: vi.fn(async () => [
    {
      slug: "camiseta-basica",
      name: "Camiseta básica",
      imageUrl: "/images/products/camiseta-basica.svg",
      priceCents: 1999,
      currency: "EUR",
      category: { slug: "camisetas", name: "Camisetas" },
      createdAt: new Date("2026-10-05T00:00:00.000Z"),
    },
  ]),
}));

describe("Home", () => {
  it("renderiza el listado del catalogo con los productos", async () => {
    render(await Home());

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Catálogo",
    );
    expect(screen.getByText("Camiseta básica")).toBeInTheDocument();
    expect(screen.getByText("Camisetas")).toBeInTheDocument();
    expect(screen.getByText("19,99 €")).toBeInTheDocument();
  });
});
