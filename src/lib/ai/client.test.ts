// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadAiConfig } from "./config";
import { AI_ERROR_MESSAGES } from "./result";
import {
  completeChat,
  createOpenAiClient,
  editImage,
  type AiClient,
} from "./client";

/**
 * Tests del cliente de IA (ai-provider-config) con transporte inyectado.
 *
 * No hay red real: el stub registra las llamadas y devuelve/rechaza a voluntad.
 * Se cubren los escenarios de aceptacion 1-5 (config por env, defaults,
 * sin clave, 429/cupo, fallo de red) y que la clave nunca se filtre.
 */

const ENV_KEYS = [
  "DEVEXPERT_API_KEY",
  "AI_PROVIDER_BASE_URL",
  "AI_CHAT_MODEL",
  "AI_CHAT_PRO_MODEL",
  "AI_IMAGE_EDIT_MODEL",
] as const;

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
  vi.unstubAllGlobals();
});

function createStub() {
  const chatCreate = vi.fn();
  const imageEdit = vi.fn();
  const client: AiClient = {
    chat: { completions: { create: chatCreate } },
    images: { edit: imageEdit },
  };
  return { client, chatCreate, imageEdit };
}

const MENSAJES = [{ role: "user" as const, content: "hola" }];
const FOTO = new File([new Uint8Array([1, 2, 3])], "foto.png", {
  type: "image/png",
});

describe("completeChat / editImage sin clave", () => {
  it("devuelve missing_api_key sin llamar al transporte", async () => {
    const { client, chatCreate, imageEdit } = createStub();

    const chat = await completeChat({ messages: MENSAJES }, client);
    const image = await editImage({ image: FOTO, prompt: "prueba" }, client);

    expect(chat.ok).toBe(false);
    expect(image.ok).toBe(false);
    if (!chat.ok) expect(chat.code).toBe("missing_api_key");
    if (!image.ok) expect(image.code).toBe("missing_api_key");
    expect(chatCreate).not.toHaveBeenCalled();
    expect(imageEdit).not.toHaveBeenCalled();
  });

  it("trata la clave vacia o con espacios como ausente", async () => {
    process.env.DEVEXPERT_API_KEY = "   ";
    const { client, chatCreate } = createStub();

    const chat = await completeChat({ messages: MENSAJES }, client);

    expect(chat.ok).toBe(false);
    if (!chat.ok) expect(chat.code).toBe("missing_api_key");
    expect(chatCreate).not.toHaveBeenCalled();
  });
});

describe("configuracion por entorno (no cableada)", () => {
  it("envia el modelo de chat configurado al transporte", async () => {
    process.env.DEVEXPERT_API_KEY = "sk-test";
    process.env.AI_CHAT_MODEL = "modelo-chat-custom";
    const { client, chatCreate } = createStub();
    chatCreate.mockResolvedValue({ choices: [{ message: { content: "ok" } }] });

    await completeChat({ messages: MENSAJES }, client);

    expect(chatCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "modelo-chat-custom", messages: MENSAJES }),
    );
  });

  it("envia el modelo de imagen configurado al transporte", async () => {
    process.env.DEVEXPERT_API_KEY = "sk-test";
    process.env.AI_IMAGE_EDIT_MODEL = "modelo-imagen-custom";
    const { client, imageEdit } = createStub();
    imageEdit.mockResolvedValue({ data: [{ b64_json: "aW1hZ2Vu" }] });

    await editImage({ image: FOTO, prompt: "prueba" }, client);

    expect(imageEdit).toHaveBeenCalledWith(
      expect.objectContaining({ model: "modelo-imagen-custom", prompt: "prueba" }),
    );
  });

  it("permite sobreescribir el modelo por llamada", async () => {
    process.env.DEVEXPERT_API_KEY = "sk-test";
    process.env.AI_CHAT_MODEL = "modelo-chat-custom";
    const { client, chatCreate } = createStub();
    chatCreate.mockResolvedValue({ choices: [{ message: { content: "ok" } }] });

    await completeChat({ messages: MENSAJES, model: "modelo-chat-pro" }, client);

    expect(chatCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "modelo-chat-pro" }),
    );
  });

  it("createOpenAiClient usa la URL base configurada", () => {
    process.env.DEVEXPERT_API_KEY = "sk-test";
    process.env.AI_PROVIDER_BASE_URL = "https://otro-gateway.example/v1";

    const client = createOpenAiClient(loadAiConfig());

    expect(client.baseURL).toBe("https://otro-gateway.example/v1");
  });

  it("createOpenAiClient usa la URL base por defecto de DevExpert", () => {
    process.env.DEVEXPERT_API_KEY = "sk-test";

    const client = createOpenAiClient(loadAiConfig());

    expect(client.baseURL).toBe("https://inference.devexpert.io/v1");
  });
});

describe("mapeo de errores del gateway", () => {
  it("mapea el 429 (cupo semanal agotado) a quota_exhausted", async () => {
    process.env.DEVEXPERT_API_KEY = "sk-test";
    const { client, chatCreate } = createStub();
    chatCreate.mockRejectedValue(
      Object.assign(new Error("rate limited"), { status: 429 }),
    );

    const result = await completeChat({ messages: MENSAJES }, client);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("quota_exhausted");
      expect(result.message).toBe(AI_ERROR_MESSAGES.quota_exhausted);
    }
  });

  it("mapea un codigo de cuota sin status a quota_exhausted", async () => {
    process.env.DEVEXPERT_API_KEY = "sk-test";
    const { client, imageEdit } = createStub();
    imageEdit.mockRejectedValue({ code: "insufficient_quota" });

    const result = await editImage({ image: FOTO, prompt: "prueba" }, client);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("quota_exhausted");
  });

  it("mapea fallo de red a provider_error sin lanzar", async () => {
    process.env.DEVEXPERT_API_KEY = "sk-test";
    const { client, chatCreate } = createStub();
    chatCreate.mockRejectedValue(new Error("fetch failed"));

    const result = await completeChat({ messages: MENSAJES }, client);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("provider_error");
      expect(result.message).toBe(AI_ERROR_MESSAGES.provider_error);
    }
  });

  it("mapea un error 5xx a provider_error sin lanzar", async () => {
    process.env.DEVEXPERT_API_KEY = "sk-test";
    const { client, imageEdit } = createStub();
    imageEdit.mockRejectedValue(
      Object.assign(new Error("server error"), { status: 500 }),
    );

    const result = await editImage({ image: FOTO, prompt: "prueba" }, client);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("provider_error");
  });
});

describe("exito", () => {
  it("devuelve ok con el contenido del chat", async () => {
    process.env.DEVEXPERT_API_KEY = "sk-test";
    const { client, chatCreate } = createStub();
    chatCreate.mockResolvedValue({
      choices: [{ message: { content: "Hola, ¿en qué te ayudo?" } }],
    });

    const result = await completeChat({ messages: MENSAJES }, client);

    expect(result).toEqual({
      ok: true,
      data: { content: "Hola, ¿en qué te ayudo?" },
    });
  });

  it("devuelve ok con la imagen base64 (respuesta b64_json)", async () => {
    process.env.DEVEXPERT_API_KEY = "sk-test";
    const { client, imageEdit } = createStub();
    imageEdit.mockResolvedValue({ data: [{ b64_json: "aW1hZ2Vu" }] });

    const result = await editImage({ image: FOTO, prompt: "prueba" }, client);

    expect(result).toEqual({ ok: true, data: { imageBase64: "aW1hZ2Vu" } });
  });

  it("normaliza a base64 cuando el gateway responde con url", async () => {
    process.env.DEVEXPERT_API_KEY = "sk-test";
    const { client, imageEdit } = createStub();
    imageEdit.mockResolvedValue({ data: [{ url: "https://cdn.example/img.png" }] });

    const bytes = new Uint8Array([104, 111, 108, 97]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => bytes.buffer,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await editImage({ image: FOTO, prompt: "prueba" }, client);

    expect(fetchMock).toHaveBeenCalledWith("https://cdn.example/img.png");
    expect(result).toEqual({
      ok: true,
      data: { imageBase64: Buffer.from(bytes).toString("base64") },
    });
  });

  it("devuelve provider_error si la edicion no trae imagen", async () => {
    process.env.DEVEXPERT_API_KEY = "sk-test";
    const { client, imageEdit } = createStub();
    imageEdit.mockResolvedValue({ data: [] });

    const result = await editImage({ image: FOTO, prompt: "prueba" }, client);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("provider_error");
  });
});

describe("no filtra la clave", () => {
  it("ningun mensaje de error contiene la clave", async () => {
    const secret = "sk-super-secreto-123";
    process.env.DEVEXPERT_API_KEY = secret;
    const { client, chatCreate, imageEdit } = createStub();

    chatCreate.mockRejectedValue(
      Object.assign(new Error(`boom ${secret}`), { status: 500 }),
    );
    imageEdit.mockRejectedValue(
      Object.assign(new Error(`quota ${secret}`), { status: 429 }),
    );

    const chat = await completeChat({ messages: MENSAJES }, client);
    const image = await editImage({ image: FOTO, prompt: "prueba" }, client);

    expect(JSON.stringify(chat)).not.toContain(secret);
    expect(JSON.stringify(image)).not.toContain(secret);
  });
});
