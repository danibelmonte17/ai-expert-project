// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_MESSAGES } from "@/lib/ai";
import { GET } from "./route";

/**
 * Test de la sonda `GET /api/ai/status` (ai-provider-config, scenarios 4/6).
 * Se invoca el handler directamente; no se arranca dev server ni se hace red.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/ai/status", () => {
  it("responde 200 en modo degradado sin clave", async () => {
    vi.stubEnv("DEVEXPERT_API_KEY", "");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      configured: false,
      message: AI_MESSAGES.disabled,
    });
  });

  it("responde 200 con configured true cuando hay clave", async () => {
    vi.stubEnv("DEVEXPERT_API_KEY", "sk-test-clave");

    const response = await GET();
    const body = (await response.json()) as {
      configured: boolean;
      message: string;
    };

    expect(response.status).toBe(200);
    expect(body.configured).toBe(true);
  });
});
