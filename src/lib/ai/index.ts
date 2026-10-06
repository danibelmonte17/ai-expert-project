/**
 * API publica de la capa de IA (ai-provider-config).
 *
 * Transporte + normalizacion de resultado unicamente: sin prompts de dominio,
 * sin contexto de catalogo y sin persistencia (eso llega con `chatbot-*` y
 * `tryon-*`). Sin clave, todas las funciones degradan con `AI_MESSAGES.disabled`
 * y sin llamadas de red.
 */

import type OpenAI from "openai";
import type { Uploadable } from "openai";
import { createAiClient } from "./client";
import { getAiConfig, isAiConfigured } from "./config";
import { AI_MESSAGES, normalizeAiError, type AiResult } from "./errors";

export { AI_DEFAULTS, getAiConfig, isAiConfigured } from "./config";
export type { AiConfig, AiModels } from "./config";
export { createAiClient } from "./client";
export { AI_MESSAGES, normalizeAiError } from "./errors";
export type { AiError, AiErrorCode, AiResult } from "./errors";

export interface AiStatus {
  configured: boolean;
  message: string;
}

/**
 * Estado de la IA para sondas/UI: `configured: false` + mensaje claro sin
 * clave. `configured` significa "hay clave", no "clave valida".
 */
export function getAiStatus(): AiStatus {
  if (!isAiConfigured()) {
    return { configured: false, message: AI_MESSAGES.disabled };
  }
  return { configured: true, message: "" };
}

export interface ChatCompletionInput {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  /** Sobrescribe `AI_CHAT_MODEL`/default (`chat`, o `chat-pro`). */
  model?: string;
  /** Cliente inyectable para tests; por defecto se construye el singleton. */
  client?: OpenAI;
}

/**
 * Completion de chat contra el gateway configurado.
 *
 * Sin clave devuelve `ai_disabled` de inmediato (sin red ni cliente). Los
 * errores del proveedor se normalizan (429 -> cupo).
 */
export async function chatCompletion(
  input: ChatCompletionInput,
): Promise<AiResult<string>> {
  const config = getAiConfig();
  if (!isAiConfigured(config)) {
    return { ok: false, code: "ai_disabled", message: AI_MESSAGES.disabled };
  }

  const client = input.client ?? createAiClient(config);
  try {
    const completion = await client.chat.completions.create({
      model: input.model ?? config.models.chat,
      messages: input.messages,
    });
    return { ok: true, data: completion.choices[0]?.message?.content ?? "" };
  } catch (error) {
    return normalizeAiError(error);
  }
}

export interface ImageEditInput {
  /** Imagen a editar (archivo/stream de subida del SDK). */
  image: Uploadable | Array<Uploadable>;
  prompt: string;
  /** Sobrescribe `AI_IMAGE_EDIT_MODEL`/default (`image-edit`). */
  model?: string;
  /** Cliente inyectable para tests; por defecto se construye el singleton. */
  client?: OpenAI;
}

/**
 * Edicion de imagen contra el gateway configurado (primitivo de `tryon-result`).
 *
 * Devuelve la URL/base64 de la imagen resultante. Mismo contrato de degradacion
 * y normalizacion que `chatCompletion`.
 */
export async function imageEdit(
  input: ImageEditInput,
): Promise<AiResult<string>> {
  const config = getAiConfig();
  if (!isAiConfigured(config)) {
    return { ok: false, code: "ai_disabled", message: AI_MESSAGES.disabled };
  }

  const client = input.client ?? createAiClient(config);
  try {
    const response = await client.images.edit({
      model: input.model ?? config.models.imageEdit,
      image: input.image,
      prompt: input.prompt,
    });
    const image = response.data?.[0];
    return { ok: true, data: image?.url ?? image?.b64_json ?? "" };
  } catch (error) {
    return normalizeAiError(error);
  }
}
