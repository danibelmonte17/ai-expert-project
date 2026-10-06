// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_DEFAULTS, getAiConfig, isAiConfigured } from "./config";

/**
 * Tests de la configuracion env-driven de IA (ai-provider-config, scenarios 1-3).
 * No hay red ni clave real: `vi.stubEnv` controla `process.env`.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAiConfig", () => {
  it("usa los defaults documentados cuando no hay variables AI_*", () => {
    vi.stubEnv("AI_BASE_URL", "");
    vi.stubEnv("AI_CHAT_MODEL", "   ");
    vi.stubEnv("AI_IMAGE_EDIT_MODEL", "");
    vi.stubEnv("AI_EMBEDDING_MODEL", "");
    vi.stubEnv("DEVEXPERT_API_KEY", "");

    const config = getAiConfig();

    expect(config.baseUrl).toBe("https://inference.devexpert.io/v1");
    expect(config.models).toEqual({
      chat: "chat",
      imageEdit: "image-edit",
      embedding: "embedding",
    });
    expect(config.apiKey).toBe("");
  });

  it("sobrescribe base URL y modelos desde env", () => {
    vi.stubEnv("AI_BASE_URL", "https://otro-proveedor.example/v1");
    vi.stubEnv("AI_CHAT_MODEL", "chat-pro");
    vi.stubEnv("AI_IMAGE_EDIT_MODEL", "image-edit-pro");
    vi.stubEnv("AI_EMBEDDING_MODEL", "embedding-pro");

    const config = getAiConfig();

    expect(config.baseUrl).toBe("https://otro-proveedor.example/v1");
    expect(config.models).toEqual({
      chat: "chat-pro",
      imageEdit: "image-edit-pro",
      embedding: "embedding-pro",
    });
  });

  it("expone los defaults como fuente unica en codigo", () => {
    expect(AI_DEFAULTS.baseUrl).toBe("https://inference.devexpert.io/v1");
    expect(AI_DEFAULTS.models).toEqual({
      chat: "chat",
      imageEdit: "image-edit",
      embedding: "embedding",
    });
  });
});

describe("isAiConfigured", () => {
  it("trata clave vacia o solo espacios como no configurada", () => {
    vi.stubEnv("DEVEXPERT_API_KEY", "");

    expect(isAiConfigured()).toBe(false);
    expect(isAiConfigured(getAiConfig())).toBe(false);

    vi.stubEnv("DEVEXPERT_API_KEY", "   ");

    expect(isAiConfigured()).toBe(false);
  });

  it("considera configurada una clave con contenido", () => {
    vi.stubEnv("DEVEXPERT_API_KEY", "sk-test-clave");

    expect(isAiConfigured()).toBe(true);
    expect(getAiConfig().apiKey).toBe("sk-test-clave");
  });
});
