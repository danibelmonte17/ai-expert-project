import { getAiStatus } from "@/lib/ai";

/**
 * Sonda observable del estado de IA (ai-provider-config).
 *
 * Siempre responde 200: la ausencia de `DEVEXPERT_API_KEY` es un modo degradado
 * valido, no un error HTTP. El body es `{ configured, message }`.
 */
export async function GET(): Promise<Response> {
  return Response.json(getAiStatus(), { status: 200 });
}
