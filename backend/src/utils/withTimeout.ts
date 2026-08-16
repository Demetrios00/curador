import { AppError } from "../middleware/errorHandler";

/**
 * Envolve uma Promise com um limite de tempo. Sem isso, uma dependência
 * externa lenta ou com problema de rede (Firestore, LLM, futuras tools MCP)
 * pode deixar uma requisição pendurada indefinidamente. Lança `AppError`
 * 504 (Gateway Timeout) se o limite for excedido — a promise original
 * continua rodando em segundo plano até resolver/rejeitar por conta própria,
 * mas o cliente HTTP já recebeu uma resposta.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      setTimeout(() => {
        reject(new AppError(`Tempo limite excedido em "${label}" (${ms}ms).`, 504, "TIMEOUT"));
      }, ms);
    }),
  ]);
}
