/**
 * Cliente HTTP para o backend do CuraDor.
 *
 * IMPORTANTE: `API_BASE_URL` é apenas o endereço do backend — não é um
 * segredo. Segredos (chave de LLM etc.) vivem somente no backend
 * (variáveis de ambiente do servidor), nunca aqui no app mobile.
 *
 * Ajuste via variável de ambiente pública do Expo (embutida no build,
 * segura por natureza — é apenas uma URL, não uma credencial):
 *
 *   EXPO_PUBLIC_API_BASE_URL=http://SEU_IP_NA_REDE_LOCAL:3333
 *
 * Notas de rede ao testar:
 * - iOS Simulator: "http://localhost:3333" funciona.
 * - Android Emulator: use "http://10.0.2.2:3333" (localhost do host).
 * - Dispositivo físico: use o IP da sua máquina na rede local (ex.: 192.168.x.x),
 *   com o celular na mesma rede Wi-Fi do computador rodando o backend.
 */
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3333";

/** Sem limite de tempo, uma rede lenta ou o backend fora do ar deixaria o chat "Digitando..." para sempre. */
const REQUEST_TIMEOUT_MS = 25_000;

export interface ChatMessagePayload {
  role: "user" | "assistant";
  content: string;
}

interface ChatResponse {
  reply: string;
}

interface BackendErrorBody {
  error?: { code?: string; message?: string };
}

/**
 * Envia o histórico da conversa ao backend, que consulta a LLM configurada
 * (OpenRouter, hoje) sem expor nenhuma chave ao app mobile.
 *
 * Substitui a antiga `fetchAIResponse` de `AgenteIA.tsx`, que chamava a
 * OpenRouter diretamente do cliente com a chave hardcoded em
 * `config/openrouter.ts` (ver auditoria Fase 0 — achado crítico de segurança).
 */
export async function sendChatMessage(messages: ChatMessagePayload[]): Promise<string> {
  // AbortController manual (em vez de AbortSignal.timeout) por compatibilidade
  // com versões do Hermes/React Native que ainda não têm o helper estático.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("O assistente demorou demais para responder. Tente novamente.");
    }
    throw new Error("Não foi possível conectar ao backend. Verifique sua conexão e o endereço configurado.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errBody: BackendErrorBody | null = await response.json().catch(() => null);
    throw new Error(errBody?.error?.message ?? `Backend respondeu ${response.status}`);
  }

  const data = (await response.json()) as ChatResponse;
  return data.reply;
}
