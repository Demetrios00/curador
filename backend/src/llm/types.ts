export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Contrato que qualquer provedor de LLM deve implementar. Isso permite
 * trocar de fornecedor (OpenRouter, OpenAI, Anthropic, etc.) sem alterar
 * controllers/agentes que dependem apenas desta interface — requisito da
 * Seção 4 do projeto ("a arquitetura deve evitar dependência rígida de um
 * fornecedor específico").
 */
export interface LLMProvider {
  complete(messages: ChatMessage[]): Promise<string>;
}
