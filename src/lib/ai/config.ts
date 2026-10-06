/**
 * Configuracion del proveedor de IA, gobernada por variables de entorno
 * (ai-provider-config).
 *
 * La ruta de proveedor/modelo NO esta cableada en la logica: todo se lee en
 * runtime de `process.env`, con los defaults documentados aqui (y replicados
 * como comentarios en `.env.example`). Los consumidores (chatbot/try-on) deben
 * leer la config de este modulo en vez de inventar endpoints o nombres de
 * modelo.
 */

export interface AiModels {
  /** Modelo de chat por defecto (`chat`; se puede pedir `chat-pro` por parametro). */
  chat: string;
  /** Modelo de edicion de imagen (`image-edit`). */
  imageEdit: string;
  /** Modelo de embeddings, reservado para `chatbot-recommend`. */
  embedding: string;
}

export interface AiConfig {
  /** Endpoint OpenAI-compatible. */
  baseUrl: string;
  /** Clave personal del gateway. Cadena vacia = modo degradado. */
  apiKey: string;
  models: AiModels;
}

/** Defaults documentados; unico lugar del codigo con estos valores. */
export const AI_DEFAULTS = {
  baseUrl: "https://inference.devexpert.io/v1",
  models: {
    chat: "chat",
    imageEdit: "image-edit",
    embedding: "embedding",
  },
} as const;

/**
 * Normaliza una variable de entorno: `undefined`, cadena vacia o solo espacios
 * cuentan como "no definida" (se aplica el default).
 */
function readEnv(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Lee la configuracion de IA en runtime (nunca en import time). */
export function getAiConfig(): AiConfig {
  return {
    baseUrl: readEnv(process.env.AI_BASE_URL) ?? AI_DEFAULTS.baseUrl,
    apiKey: readEnv(process.env.DEVEXPERT_API_KEY) ?? "",
    models: {
      chat: readEnv(process.env.AI_CHAT_MODEL) ?? AI_DEFAULTS.models.chat,
      imageEdit:
        readEnv(process.env.AI_IMAGE_EDIT_MODEL) ??
        AI_DEFAULTS.models.imageEdit,
      embedding:
        readEnv(process.env.AI_EMBEDDING_MODEL) ??
        AI_DEFAULTS.models.embedding,
    },
  };
}

/** `true` si hay clave de gateway no vacia. */
export function isAiConfigured(config: AiConfig = getAiConfig()): boolean {
  return config.apiKey.length > 0;
}
