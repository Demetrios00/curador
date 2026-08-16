import { AppError } from "../middleware/errorHandler";
import type { ChatMessage, LLMProvider } from "./types";

interface OpenRouterProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  /** Limite de tempo da chamada HTTP, em ms. Sem isto, uma rede lenta/instável deixa a requisição pendurada para sempre. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Implementação de `LLMProvider` para a API da OpenRouter. A chave nunca
 * é lida diretamente aqui — vem sempre de `config/env.ts`, que por sua vez
 * lê de variável de ambiente do servidor (nunca do app mobile).
 */
export class OpenRouterProvider implements LLMProvider {
  constructor(private readonly config: OpenRouterProviderConfig) {}

  async complete(messages: ChatMessage[]): Promise<string> {
    // Segunda camada de defesa: mesmo que um controller esqueça de checar
    // `env.llmApiKey` antes de chamar `complete()`, nunca mandamos um header
    // de autenticação vazio para a OpenRouter (que responde só "Missing
    // Authentication header", sem indicar a causa real).
    if (!this.config.apiKey) {
      throw new AppError(
        "Serviço de LLM não configurado no backend. Defina LLM_API_KEY no .env.",
        500,
        "LLM_NOT_CONFIGURED"
      );
    }

    let response: Response;

    try {
      response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://curador.app",
          "X-Title": "CuraDor",
        },
        body: JSON.stringify({ model: this.config.model, messages }),
        signal: AbortSignal.timeout(this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        console.error("[openrouter-provider] tempo limite excedido ao chamar a OpenRouter");
        throw new AppError(
          "O provedor de LLM demorou demais para responder. Tente novamente.",
          504,
          "LLM_TIMEOUT"
        );
      }
      console.error("[openrouter-provider] erro de rede:", err);
      throw new AppError(
        "Falha de rede ao consultar o provedor de LLM.",
        502,
        "LLM_NETWORK_ERROR"
      );
    }

    if (!response.ok) {
      const errBody = await response.text();
      console.error("[openrouter-provider] erro do provedor:", response.status, errBody);
      throw new AppError(
        "Falha ao consultar o provedor de LLM. Tente novamente em instantes.",
        502,
        "LLM_PROVIDER_ERROR"
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    return data.choices?.[0]?.message?.content ?? "Não foi possível obter uma resposta.";
  }
}
