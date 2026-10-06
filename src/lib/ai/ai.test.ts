// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests de la capa de IA (ai-provider-config).
 *
 * El SDK `openai` se mockea por completo: no hay red ni clave real. Se cubren
 * la degradacion sin clave (sin excepcion ni llamadas), el wiring
 * `apiKey`+`baseURL`+modelo, y la normalizacion de 429 (scenarios 3-5).
 */

const mocks = vi.hoisted(() => ({
  chatCreate: vi.fn(),
  imagesEdit: vi.fn(),
  clientConstructor: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mocks.chatCreate } };
    images = { edit: mocks.imagesEdit };
    constructor(options: unknown) {
      mocks.clientConstructor(options);
    }
  },
}));

import {
  AI_MESSAGES,
  chatCompletion,
  createAiClient,
  getAiStatus,
  imageEdit,
  normalizeAiError,
} from "./index";

const photo = new File(["foto"], "foto.png", { type: "image/png" });

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAiStatus", () => {
  it("sin clave devuelve configured false y el mensaje de degradacion", () => {
    vi.stubEnv("DEVEXPERT_API_KEY", "");

    expect(getAiStatus()).toEqual({
      configured: false,
      message: AI_MESSAGES.disabled,
    });
  });

  it("con clave devuelve configured true", () => {
    vi.stubEnv("DEVEXPERT_API_KEY", "sk-test-clave");

    expect(getAiStatus().configured).toBe(true);
  });
});

describe("chatCompletion", () => {
  it("sin clave degrada con ai_disabled sin construir cliente ni llamar al SDK", async () => {
    vi.stubEnv("DEVEXPERT_API_KEY", "");

    const result = await chatCompletion({
      messages: [{ role: "user", content: "hola" }],
    });

    expect(result).toEqual({
      ok: false,
      code: "ai_disabled",
      message: AI_MESSAGES.disabled,
    });
    expect(mocks.clientConstructor).not.toHaveBeenCalled();
    expect(mocks.chatCreate).not.toHaveBeenCalled();
  });

  it("con clave usa el modelo de chat configurado por env", async () => {
    vi.stubEnv("DEVEXPERT_API_KEY", "sk-test-clave");
    vi.stubEnv("AI_CHAT_MODEL", "chat-pro");
    mocks.chatCreate.mockResolvedValue({
      choices: [{ message: { content: "Hola desde el gateway" } }],
    });

    const messages = [{ role: "user" as const, content: "hola" }];
    const result = await chatCompletion({ messages });

    expect(mocks.clientConstructor).toHaveBeenCalledWith({
      apiKey: "sk-test-clave",
      baseURL: "https://inference.devexpert.io/v1",
    });
    expect(mocks.chatCreate).toHaveBeenCalledWith({
      model: "chat-pro",
      messages,
    });
    expect(result).toEqual({ ok: true, data: "Hola desde el gateway" });
  });

  it("normaliza un 429 del proveedor como ai_quota", async () => {
    vi.stubEnv("DEVEXPERT_API_KEY", "sk-test-clave");
    mocks.chatCreate.mockRejectedValue({ status: 429 });

    const result = await chatCompletion({
      messages: [{ role: "user", content: "hola" }],
    });

    expect(result).toEqual({
      ok: false,
      code: "ai_quota",
      message: AI_MESSAGES.quota,
    });
  });
});

describe("imageEdit", () => {
  it("sin clave degrada con ai_disabled sin llamar al SDK", async () => {
    vi.stubEnv("DEVEXPERT_API_KEY", "");

    const result = await imageEdit({ image: photo, prompt: "prueba la prenda" });

    expect(result).toEqual({
      ok: false,
      code: "ai_disabled",
      message: AI_MESSAGES.disabled,
    });
    expect(mocks.imagesEdit).not.toHaveBeenCalled();
  });

  it("con clave usa el modelo de edicion configurado por env", async () => {
    vi.stubEnv("DEVEXPERT_API_KEY", "sk-test-clave");
    vi.stubEnv("AI_IMAGE_EDIT_MODEL", "image-edit-pro");
    mocks.imagesEdit.mockResolvedValue({
      data: [{ url: "https://cdn.example/resultado.png" }],
    });

    const result = await imageEdit({ image: photo, prompt: "prueba la prenda" });

    expect(mocks.imagesEdit).toHaveBeenCalledWith({
      model: "image-edit-pro",
      image: photo,
      prompt: "prueba la prenda",
    });
    expect(result).toEqual({
      ok: true,
      data: "https://cdn.example/resultado.png",
    });
  });
});

describe("createAiClient", () => {
  it("construye el SDK con apiKey y baseURL de la config (sin llamar al gateway)", () => {
    vi.stubEnv("DEVEXPERT_API_KEY", "sk-test-clave");
    vi.stubEnv("AI_BASE_URL", "https://otro-proveedor.example/v1");

    createAiClient();

    expect(mocks.clientConstructor).toHaveBeenCalledTimes(1);
    expect(mocks.clientConstructor).toHaveBeenCalledWith({
      apiKey: "sk-test-clave",
      baseURL: "https://otro-proveedor.example/v1",
    });
  });
});

describe("normalizeAiError", () => {
  it("traduce un 429 a ai_quota", () => {
    expect(normalizeAiError({ response: { status: 429 } })).toEqual({
      ok: false,
      code: "ai_quota",
      message: AI_MESSAGES.quota,
    });
  });

  it("traduce cualquier otro fallo a ai_error sin filtrar detalles crudos", () => {
    const result = normalizeAiError(new Error("boom sk-secreto"));

    expect(result).toEqual({
      ok: false,
      code: "ai_error",
      message: AI_MESSAGES.error,
    });
    expect(result.message).not.toContain("sk-secreto");
    expect(result.message).not.toContain("boom");
  });
});
