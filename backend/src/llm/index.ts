import { env } from "../config/env";
import { OpenRouterProvider } from "./openRouterProvider";
import type { LLMProvider } from "./types";

/**
 * Ponto único de acesso ao provedor de LLM configurado. Para trocar de
 * fornecedor no futuro, basta implementar `LLMProvider` e trocar a
 * instância criada aqui — nenhum controller/agente conhece detalhes do
 * provedor concreto.
 */
export const llmProvider: LLMProvider = new OpenRouterProvider({
  apiKey: env.llmApiKey,
  baseUrl: env.llmBaseUrl,
  model: env.llmModel,
  fallbackModels: env.llmFallbackModels,
  timeoutMs: env.llmTimeoutMs,
  maxTokens: env.llmMaxTokens,
  disableReasoning: env.llmDisableReasoning,
});

export type { ChatMessage, LLMProvider } from "./types";
export { HEALTH_ASSISTANT_SYSTEM_PROMPT } from "./systemPrompt";
