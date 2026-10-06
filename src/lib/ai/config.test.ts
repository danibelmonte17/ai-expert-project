// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  AI_DEFAULT_BASE_URL,
  AI_DEFAULT_CHAT_MODEL,
  AI_DEFAULT_CHAT_PRO_MODEL,
  AI_DEFAULT_IMAGE_EDIT_MODEL,
  isAiConfigured,
  loadAiConfig,
} from "./config";

/**
 * Tests de la configuracion de IA por entorno (ai-provider-config).
 * No tocan red: solo leen el objeto de entorno inyectado.
 */

describe("loadAiConfig", () => {
  it("usa los defaults documentados de DevExpert con el entorno vacio", () => {
    const config = loadAiConfig({});

    expect(config.apiKey).toBeNull();
    expect(config.baseUrl).toBe("https://inference.devexpert.io/v1");
    expect(config.chatModel).toBe("chat");
    expect(config.chatProModel).toBe("chat-pro");
    expect(config.imageEditModel).toBe("image-edit");
    expect(config.baseUrl).toBe(AI_DEFAULT_BASE_URL);
    expect(config.chatModel).toBe(AI_DEFAULT_CHAT_MODEL);
    expect(config.chatProModel).toBe(AI_DEFAULT_CHAT_PRO_MODEL);
    expect(config.imageEditModel).toBe(AI_DEFAULT_IMAGE_EDIT_MODEL);
  });

  it("respeta los overrides de URL base y modelos", () => {
    const config = loadAiConfig({
      AI_PROVIDER_BASE_URL: "https://otro-gateway.example/v1",
      AI_CHAT_MODEL: "chat-test",
      AI_CHAT_PRO_MODEL: "chat-pro-test",
      AI_IMAGE_EDIT_MODEL: "image-edit-test",
    });

    expect(config.baseUrl).toBe("https://otro-gateway.example/v1");
    expect(config.chatModel).toBe("chat-test");
    expect(config.chatProModel).toBe("chat-pro-test");
    expect(config.imageEditModel).toBe("image-edit-test");
  });

  it("normaliza la clave vacia o solo con espacios a null", () => {
    expect(loadAiConfig({ DEVEXPERT_API_KEY: "" }).apiKey).toBeNull();
    expect(loadAiConfig({ DEVEXPERT_API_KEY: "   " }).apiKey).toBeNull();
  });

  it("recorta la clave cuando tiene valor", () => {
    expect(loadAiConfig({ DEVEXPERT_API_KEY: "  sk-test  " }).apiKey).toBe("sk-test");
  });

  it("cae a los defaults si una variable de entorno viene vacia", () => {
    const config = loadAiConfig({ AI_PROVIDER_BASE_URL: "  ", AI_CHAT_MODEL: "" });

    expect(config.baseUrl).toBe(AI_DEFAULT_BASE_URL);
    expect(config.chatModel).toBe(AI_DEFAULT_CHAT_MODEL);
  });
});

describe("isAiConfigured", () => {
  it("es false sin clave y true con clave", () => {
    expect(isAiConfigured(loadAiConfig({}))).toBe(false);
    expect(isAiConfigured(loadAiConfig({ DEVEXPERT_API_KEY: "sk-test" }))).toBe(true);
  });
});
