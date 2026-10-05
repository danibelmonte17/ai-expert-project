import { defineConfig, devices } from "@playwright/test";

/**
 * Verificación visual real (navegador) para la tienda.
 *
 * Levanta el servidor Next en un puerto dedicado y ejecuta los specs
 * `*.visual.ts` contra un navegador real. Reservado a comprobaciones de
 * disposición/estilos; el gate rápido sigue siendo `./init.sh` (sin navegador).
 */
const PORT = 3100;

export default defineConfig({
  testDir: "./tests/visual",
  testMatch: /.*\.visual\.ts/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  outputDir: "test-results/visual",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node node_modules/next/dist/bin/next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 120_000,
    reuseExistingServer: true,
    stdout: "pipe",
    stderr: "pipe",
  },
});
