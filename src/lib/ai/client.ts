import OpenAI from "openai";
import { type AiConfig, loadAiConfig } from "./config";
import { aiFailure, type AiResult } from "./result";

/**
 * Cliente del gateway de IA (ai-provider-config).
 *
 * Unica puerta al gateway OpenAI-compatible de DevExpert Inference. Ninguna
 * otra capa de `src/` debe llamar al gateway directamente. El cliente se
 * construye desde `loadAiConfig` y es inyectable por parametro para poder
 * testear sin red.
 *
 * Solo servidor: importar desde RSC / route handlers / server actions, nunca
 * desde componentes cliente (la clave no debe empaquetarse para el navegador).
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompleteChatInput {
  messages: ChatMessage[];
  /** Modelo a usar; por defecto `config.chatModel`. */
  model?: string;
}

export interface EditImageInput {
  /** Foto de entrada (multipart). */
  image: File;
  /** Prompt con la prenda a probar. */
  prompt: string;
  /** Modelo a usar; por defecto `config.imageEditModel`. */
  model?: string;
}

interface ChatCompletionInput {
  model: string;
  messages: ChatMessage[];
}

interface ChatCompletionOutput {
  choices: Array<{ message: { content?: string | null } }>;
}

interface ImageEditInput {
  model: string;
  image: File;
  prompt: string;
}

interface ImageEditOutput {
  data?: Array<{ b64_json?: string; url?: string }>;
}

/**
 * Subconjunto estructural del cliente `openai` que usa la app, para inyectar
 * un stub en los tests sin red.
 */
export interface AiClient {
  chat: {
    completions: {
      create(body: ChatCompletionInput): Promise<ChatCompletionOutput>;
    };
  };
  images: {
    edit(body: ImageEditInput): Promise<ImageEditOutput>;
  };
}

/**
 * Construye el cliente `openai` apuntando al gateway configurado.
 * Solo se invoca cuando hay clave (el SDK lanza si `apiKey` esta vacia).
 */
export function createOpenAiClient(config: AiConfig): OpenAI {
  return new OpenAI({ apiKey: config.apiKey ?? "", baseURL: config.baseUrl });
}

/**
 * El gateway puede devolver la edicion como base64 o como URL. Normalizamos
 * siempre a base64 para que el contrato sea estable.
 */
async function normalizeImageBase64(
  data: ImageEditOutput["data"],
): Promise<string | null> {
  const first = data?.[0];
  if (!first) return null;
  if (first.b64_json) return first.b64_json;
  if (!first.url) return null;

  const response = await fetch(first.url);
  if (!response.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString("base64");
}

/** Detecta cupo semanal agotado: status 429 o codigo/tipo de cuota. */
function isQuotaError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const candidate = error as { status?: unknown; code?: unknown; type?: unknown };
  if (candidate.status === 429) return true;

  const code = typeof candidate.code === "string" ? candidate.code.toLowerCase() : "";
  const type = typeof candidate.type === "string" ? candidate.type.toLowerCase() : "";
  const signal = `${code} ${type}`;
  return signal.includes("quota") || signal.includes("rate_limit");
}

/** Mapea un error del gateway a un fallo controlado (nunca lanza). */
function toFailure(error: unknown): AiResult<never> {
  return aiFailure(isQuotaError(error) ? "quota_exhausted" : "provider_error");
}

/**
 * Envia mensajes al endpoint de chat completions y devuelve el texto.
 *
 * Sin clave devuelve `missing_api_key` sin tocar la red; 429 -> `quota_exhausted`;
 * cualquier otro fallo -> `provider_error`. Nunca lanza para fallos conocidos.
 */
export async function completeChat(
  input: CompleteChatInput,
  client?: AiClient,
): Promise<AiResult<{ content: string }>> {
  const config = loadAiConfig();
  if (!config.apiKey) return aiFailure("missing_api_key");

  const transport = client ?? createOpenAiClient(config);

  try {
    const completion = await transport.chat.completions.create({
      model: input.model ?? config.chatModel,
      messages: input.messages,
    });

    return {
      ok: true,
      data: { content: completion.choices[0]?.message.content ?? "" },
    };
  } catch (error) {
    return toFailure(error);
  }
}

/**
 * Edita una imagen con la prenda indicada (transporte puro: sin prompt de
 * prenda, sin persistencia ni aviso de privacidad, que son de `tryon-*`).
 *
 * Normaliza la respuesta del gateway a base64. Mismo contrato de fallos que
 * `completeChat`.
 */
export async function editImage(
  input: EditImageInput,
  client?: AiClient,
): Promise<AiResult<{ imageBase64: string }>> {
  const config = loadAiConfig();
  if (!config.apiKey) return aiFailure("missing_api_key");

  const transport = client ?? createOpenAiClient(config);

  try {
    const response = await transport.images.edit({
      model: input.model ?? config.imageEditModel,
      image: input.image,
      prompt: input.prompt,
    });

    const imageBase64 = await normalizeImageBase64(response.data);
    if (!imageBase64) return aiFailure("provider_error");

    return { ok: true, data: { imageBase64 } };
  } catch (error) {
    return toFailure(error);
  }
}
