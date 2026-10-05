import { test, expect } from "@playwright/test";

/**
 * `catalog-list`: verificación visual real de la cuadrícula responsive.
 *
 * Comprueba, en un navegador Chromium real, que la home pinta los 8 productos
 * del seed y que la cuadrícula resuelve 2 / 3 / 4 columnas en móvil, tableta y
 * escritorio (DESIGN.md, Responsive Baseline), sin desbordamiento horizontal.
 * Guarda una captura por viewport en `test-results/`.
 */
const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 812, columns: 2 },
  { name: "tablet-768", width: 768, height: 1024, columns: 3 },
  { name: "desktop-1280", width: 1280, height: 900, columns: 4 },
] as const;

test.describe("catalog-list: cuadrícula responsive", () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name} -> ${vp.columns} columnas`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");

      await expect(
        page.getByRole("heading", { level: 1, name: "Catálogo" }),
      ).toBeVisible();

      const grid = page.locator("main ul");
      await expect(grid).toBeVisible();

      const cards = grid.locator("> li");
      await expect(cards).toHaveCount(8);

      const templateColumns = await grid.evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns,
      );
      const columns = templateColumns.trim().split(/\s+/).filter(Boolean).length;
      expect(
        columns,
        `grid-template-columns resuelto por el navegador: ${templateColumns}`,
      ).toBe(vp.columns);

      const boxes = await cards.evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return {
            top: Math.round(r.top),
            left: Math.round(r.left),
            right: Math.round(r.right),
          };
        }),
      );
      const firstTop = boxes[0].top;
      const firstRow = boxes.filter((b) => b.top === firstTop);
      expect(firstRow.length, "tarjetas en la primera fila").toBe(vp.columns);

      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(
        scrollWidth,
        `scrollWidth (${scrollWidth}) <= viewport (${vp.width})`,
      ).toBeLessThanOrEqual(vp.width + 1);

      const images = grid.locator("img");
      await expect
        .poll(
          async () =>
            images.evaluateAll(
              (imgs) =>
                imgs.filter(
                  (img) =>
                    !(img as HTMLImageElement).complete ||
                    (img as HTMLImageElement).naturalWidth === 0,
                ).length,
            ),
          { message: "todas las imágenes deben cargar", timeout: 15_000 },
        )
        .toBe(0);

      await page.screenshot({
        path: `test-results/catalog-${vp.name}.png`,
        fullPage: true,
      });

      console.log(
        `[visual] ${vp.name}: grid-template-columns=${templateColumns}; primera fila=${firstRow.length}; scrollWidth=${scrollWidth}`,
      );
    });
  }
});
