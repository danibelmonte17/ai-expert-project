/**
 * Contrato de resultado de la capa de IA (ai-provider-config).
 *
 * Las funciones de IA nunca lanzan para fallos conocidos (sin clave, cupo
 * agotado, error de proveedor/red): devuelven un `AiResult` con un codigo de
 * error y un mensaje canonico en espanol. Las UIs futuras
 * (`chatbot-conversation` / `tryon-result`) muestran `message` tal cual.
 */

export type AiErrorCode =
  | "missing_api_key"
  | "quota_exhausted"
  | "provider_error";

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: AiErrorCode; message: string };

/**
 * Mensajes canonicos de degradacion (fuente unica de texto para las UIs).
 *
 * Nunca incluyen la clave ni fragmentos de ella.
 */
export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  missing_api_key:
    "Las funciones de IA no estan disponibles: falta configurar DEVEXPERT_API_KEY en el archivo .env. La tienda sigue funcionando sin IA.",
  quota_exhausted:
    "Se agoto el cupo semanal de IA. El servicio se reinicia automaticamente; intentalo de nuevo mas tarde.",
  provider_error:
    "No se pudo contactar con el servicio de IA. Comprueba tu conexion e intentalo de nuevo mas tarde.",
};

/** Construye un fallo controlado de IA a partir de su codigo. */
export function aiFailure<T>(code: AiErrorCode): AiResult<T> {
  return { ok: false, code, message: AI_ERROR_MESSAGES[code] };
}
