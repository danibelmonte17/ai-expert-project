import OpenAI from "openai";
import { getAiConfig, type AiConfig } from "./config";

/**
 * Cliente OpenAI-compatible (ai-provider-config).
 *
 * Unica puerta al SDK `openai` desde `src/` (misma disciplina que `src/lib/db`
 * con Prisma): ninguna otra capa debe instanciar `new OpenAI()`. El gateway
 * DevExpert Inference es OpenAI-compatible, asi que basta `apiKey` + `baseURL`.
 *
 * No se instancia en import time; solo cuando hay clave (las funciones de IA
 * degradan antes de construir el cliente).
 */
export function createAiClient(config: AiConfig = getAiConfig()): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });
}
