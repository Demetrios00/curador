import { AppError } from "../middleware/errorHandler";
import type { ChatMessage, LLMProvider } from "./types";

interface OpenRouterProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  /** Limite de tempo de CADA tentativa (um modelo), incluindo a leitura da resposta, em ms. */
  timeoutMs?: number;
  /** Modelos alternativos, tentados em ordem quando o anterior demora ou falha. */
  fallbackModels?: string[];
  /** Número máximo de modelos tentados por chamada (principal + alternativos). */
  maxAttempts?: number;
  maxTokens?: number;
  disableReasoning?: boolean;
}

const DEFAULT_TIMEOUT_MS = 18_000;

/** Falha "transitória": vale tentar o próximo modelo. */
class RetryableLlmError extends Error {}

/**
 * Implementação de `LLMProvider` para a API da OpenRouter. A chave nunca
 * é lida diretamente aqui — vem sempre de `config/env.ts`, que por sua vez
 * lê de variável de ambiente do servidor (nunca do app mobile).
 *
 * Correção 18/10/2026 (testes em dispositivo físico): modelos gratuitos
 * variam muito de latência ao longo do dia. Em vez de esperar um único
 * modelo até o limite, cada tentativa tem tempo próprio e, se o modelo
 * demora, falha por limite de uso (429) ou erro do provedor (5xx), a
 * chamada segue para o próximo modelo da lista (`LLM_FALLBACK_MODELS`).
 * O modelo que efetivamente respondeu e a latência são registrados no
 * console — evidência para a avaliação do TCC.
 */
export class OpenRouterProvider implements LLMProvider {
  constructor(private readonly config: OpenRouterProviderConfig) {}

  async complete(messages: ChatMessage[]): Promise<string> {
    if (!this.config.apiKey) {
      throw new AppError(
        "Serviço de LLM não configurado no backend. Defina LLM_API_KEY no .env.",
        500,
        "LLM_NOT_CONFIGURED"
      );
    }

    const models = [this.config.model, ...(this.config.fallbackModels ?? [])].slice(
      0,
      Math.max(1, this.config.maxAttempts ?? 2)
    );

    let lastError: Error | null = null;
    for (const model of models) {
      const started = Date.now();
      try {
        const content = await this.tryModel(model, messages);
        console.log(`[openrouter-provider] modelo=${model} latenciaMs=${Date.now() - started}`);
        return content;
      } catch (err) {
        if (err instanceof RetryableLlmError) {
          console.warn(`[openrouter-provider] modelo=${model} falhou após ${Date.now() - started}ms: ${err.message}`);
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    const timedOut = lastError?.message.includes("tempo limite");
    throw new AppError(
      timedOut
        ? "O provedor de LLM demorou demais para responder. Tente novamente."
        : "Falha ao consultar o provedor de LLM. Tente novamente em instantes.",
      timedOut ? 504 : 502,
      timedOut ? "LLM_TIMEOUT" : "LLM_PROVIDER_ERROR"
    );
  }

  /** Uma tentativa com um modelo. Lança `RetryableLlmError` quando vale tentar outro modelo. */
  private async tryModel(model: string, messages: ChatMessage[]): Promise<string> {
    const signal = AbortSignal.timeout(this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://curador.app",
          "X-Title": "CuraDor",
        },
        body: JSON.stringify(this.buildBody(model, messages)),
        signal,
      });

      if (!response.ok) {
        const errBody = await response.text();
        if (response.status === 429 || response.status >= 500) {
          throw new RetryableLlmError(`HTTP ${response.status}: ${errBody.slice(0, 200)}`);
        }
        console.error("[openrouter-provider] erro do provedor:", response.status, errBody);
        throw new AppError(
          "Falha ao consultar o provedor de LLM. Tente novamente em instantes.",
          502,
          "LLM_PROVIDER_ERROR"
        );
      }

      // O tempo limite também cobre a leitura do corpo: a OpenRouter envia os
      // cabeçalhos antes e transmite o corpo só ao final da geração.
      const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) throw new RetryableLlmError("resposta vazia");
      return content;
    } catch (err) {
      if (err instanceof RetryableLlmError || err instanceof AppError) throw err;
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new RetryableLlmError("tempo limite excedido");
      }
      throw new RetryableLlmError(`erro de rede: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** `reasoning` desligado: os prompts do CuraDor exigem respostas curtas e diretas. */
  private buildBody(model: string, messages: ChatMessage[]): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: this.config.maxTokens ?? 1024,
    };
    if (this.config.disableReasoning !== false) {
      body.reasoning = { enabled: false };
    }
    return body;
  }
}
