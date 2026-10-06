/**
 * Contrato de resultado y copy de degradacion de la capa de IA
 * (ai-provider-config).
 *
 * Las funciones de IA nunca lanzan por ausencia de clave: devuelven un
 * `AiResult` controlado. Los mensajes de `AI_MESSAGES` son la unica fuente de
 * copy en espanol para chatbot/try-on.
 */

export type AiErrorCode = "ai_disabled" | "ai_quota" | "ai_error";

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: AiErrorCode; message: string };

/** Rama de error de `AiResult` (sin `data`). */
export type AiError = Extract<AiResult<never>, { ok: false }>;

/** Copy en espanol reutilizable por las features de IA. */
export const AI_MESSAGES = {
  disabled:
    "Las funciones de IA no están disponibles porque falta la clave DEVEXPERT_API_KEY. Añádela en .env para activar el chatbot y la prueba virtual.",
  quota:
    "El cupo semanal de IA está agotado y se repone automáticamente. Vuelve a intentarlo más tarde.",
  error:
    "No se pudo completar la operación de IA. Inténtalo de nuevo más tarde.",
} as const;

/** Detecta un error HTTP 429 (cupo semanal agotado) sin depender del SDK. */
function isQuotaError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const candidate = error as {
    status?: unknown;
    response?: { status?: unknown };
  };
  return candidate.status === 429 || candidate.response?.status === 429;
}

/**
 * Normaliza cualquier fallo de IA a una rama de error controlada.
 *
 * - HTTP 429 -> `ai_quota`.
 * - Cualquier otro fallo -> `ai_error` con mensaje generico.
 *
 * Nunca se filtra la clave ni el detalle crudo del proveedor en `message`.
 */
export function normalizeAiError(error: unknown): AiError {
  if (isQuotaError(error)) {
    return { ok: false, code: "ai_quota", message: AI_MESSAGES.quota };
  }
  return { ok: false, code: "ai_error", message: AI_MESSAGES.error };
}
