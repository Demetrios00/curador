/**
 * Cliente HTTP para o Agente Orquestrador do backend do CuraDor
 * (`POST /api/orchestrator/route`).
 *
 * IMPORTANTE: `API_BASE_URL` é apenas o endereço do backend — não é um
 * segredo. Nenhuma chave de LLM ou credencial sensível é referenciada
 * aqui; a única informação enviada além da mensagem do paciente é o ID
 * token do Firebase do próprio usuário logado (obtido em `AgenteIA.tsx`
 * via `user.getIdToken()`), que o backend usa (`middleware/auth.ts`) para
 * identificar o paciente com segurança — nunca enviamos um `patientUid`
 * livre no corpo da requisição, isso permitiria qualquer cliente ler
 * dados de qualquer paciente só trocando um valor no JSON.
 *
 * Notas de rede ao testar:
 * - iOS Simulator: "http://localhost:3333" funciona.
 * - Android Emulator (Android Studio / AVD): use "http://10.0.2.2:3333"
 *   — é o alias que o emulador usa para "localhost do computador host".
 * - Dispositivo físico: use o IP da máquina na rede local (ex.:
 *   192.168.x.x), com o celular na mesma rede Wi-Fi do computador rodando
 *   o backend.
 *
 * Ajuste via variável de ambiente pública do Expo (arquivo `.env` na raiz
 * do projeto mobile — ver `.env.example`).
 */
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3333";

/** Sem limite de tempo, uma rede lenta ou o backend fora do ar deixaria o chat "Digitando..." para sempre. */
const REQUEST_TIMEOUT_MS = 25_000;

export type Intent = "APPOINTMENTS" | "INSTRUCTIONS" | "RESULTS" | "UNITS" | "UNKNOWN";

export interface Location {
  latitude: number;
  longitude: number;
}

/**
 * Corpo de `result` varia por agente (ver `orchestrator.controller.ts`
 * no backend), mas todos os agentes especializados incluem ao menos
 * `message` — o texto pronto para exibir ao paciente. Quando a intenção é
 * UNKNOWN, `agent` e `result` vêm `null` (nenhum agente foi selecionado).
 */
export interface OrchestratorResponse {
  requestId: string;
  intent: Intent;
  confidence: number;
  agent: string | null;
  result: ({ message?: string } & Record<string, unknown>) | null;
}

interface BackendErrorBody {
  error?: { code?: string; message?: string };
}

/**
 * Envia a mensagem do paciente ao Agente Orquestrador. Requer um ID token
 * do Firebase de um usuário autenticado — quem já garante isso é
 * `AgenteIA.tsx`, através do `useAuth()` (mesmo contexto usado no resto
 * do app).
 *
 * `location`, quando enviada, só é usada pelo backend quando a intenção
 * classificada é UNITS (Agente de Unidades) — para os demais agentes é
 * ignorada. Mesmo assim é seguro sempre enviar: não é um dado persistido
 * em nenhuma coleção do Firestore, existe só nesta chamada.
 */
export async function routeOrchestratorMessage(
  idToken: string,
  message: string,
  location?: Location
): Promise<OrchestratorResponse> {
  // AbortController manual (em vez de AbortSignal.timeout) por compatibilidade
  // com versões do Hermes/React Native que ainda não têm o helper estático.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/orchestrator/route`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ message, ...(location ? { location } : {}) }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("O assistente demorou demais para responder. Tente novamente.");
    }
    throw new Error("Não foi possível conectar ao backend. Verifique sua conexão e o endereço configurado (EXPO_PUBLIC_API_BASE_URL).");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errBody: BackendErrorBody | null = await response.json().catch(() => null);
    throw new Error(errBody?.error?.message ?? `Backend respondeu ${response.status}`);
  }

  return (await response.json()) as OrchestratorResponse;
}
