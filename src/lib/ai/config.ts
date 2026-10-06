/**
 * Configuracion de la IA por variables de entorno (ai-provider-config).
 *
 * Unica fuente del proveedor/modelo: URL base y modelos de IA nunca se
 * cablean en los puntos de llamada, se leen aqui. La clave `DEVEXPERT_API_KEY`
 * es opcional para arrancar: la tienda funciona sin ella y solo la IA degrada.
 *
 * `loadAiConfig` se lee en cada invocacion (no como constante de modulo) para
 * que los tests y los cambios de entorno en runtime se reflejen.
 */

/**
 * Entorno de donde se lee la configuracion. Es un record plano (en vez de
 * `NodeJS.ProcessEnv`, que Next.js tipa con `NODE_ENV` obligatorio) para poder
 * pasar objetos parciales en los tests.
 */
export type AiEnv = Record<string, string | undefined>;

export interface AiConfig {
  /** Clave personal de DevExpert Inference; `null` si no hay (vacia o ausente). */
  apiKey: string | null;
  /** URL base del gateway OpenAI-compatible. */
  baseUrl: string;
  /** Modelo por defecto para chat. */
  chatModel: string;
  /** Modelo para tareas de chat complejas. */
  chatProModel: string;
  /** Modelo por defecto para edicion de imagen. */
  imageEditModel: string;
}

/** Defaults documentados del gateway DevExpert Inference. */
export const AI_DEFAULT_BASE_URL = "https://inference.devexpert.io/v1";
export const AI_DEFAULT_CHAT_MODEL = "chat";
export const AI_DEFAULT_CHAT_PRO_MODEL = "chat-pro";
export const AI_DEFAULT_IMAGE_EDIT_MODEL = "image-edit";

function envValue(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

/**
 * Lee la configuracion de IA del entorno dado (por defecto `process.env`).
 *
 * - `DEVEXPERT_API_KEY` vacia o solo con espacios se normaliza a `null`.
 * - El resto de variables usan los defaults de DevExpert si faltan o estan vacias.
 */
export function loadAiConfig(env: AiEnv = process.env): AiConfig {
  const apiKey = env.DEVEXPERT_API_KEY?.trim() || null;

  return {
    apiKey,
    baseUrl: envValue(env.AI_PROVIDER_BASE_URL, AI_DEFAULT_BASE_URL),
    chatModel: envValue(env.AI_CHAT_MODEL, AI_DEFAULT_CHAT_MODEL),
    chatProModel: envValue(env.AI_CHAT_PRO_MODEL, AI_DEFAULT_CHAT_PRO_MODEL),
    imageEditModel: envValue(env.AI_IMAGE_EDIT_MODEL, AI_DEFAULT_IMAGE_EDIT_MODEL),
  };
}

/**
 * Indica si hay clave configurada, para que features/UI futuras oculten o
 * desactiven la IA de forma coherente.
 */
export function isAiConfigured(config: AiConfig = loadAiConfig()): boolean {
  return config.apiKey !== null;
}
