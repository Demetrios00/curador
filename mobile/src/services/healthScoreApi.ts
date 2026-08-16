/**
 * Cliente HTTP para o score "Saúde em Dia" do backend do CuraDor
 * (`GET /api/patients/me/health-score`).
 *
 * Ideia 4b (claude/ideia4b-score-saude-dia-proposta.md, aprovada em
 * 16/08/2026). Mesmo padrão de `orchestratorApi.ts`: só envia o ID token
 * do Firebase do usuário logado — nunca um `patientUid` livre — e o
 * backend identifica o paciente por conta própria (`middleware/auth.ts`).
 * Todo o cálculo do score mora no backend (`healthScore.service.ts`); este
 * arquivo só busca e tipa o resultado.
 */
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3333";

const REQUEST_TIMEOUT_MS = 15_000;

export interface DomainScore {
  finalizados: number;
  pendentes: number;
  score: number;
}

export type ImprovementType = "referral_pending" | "appointment_missed" | "result_processing";

export interface Improvement {
  type: ImprovementType;
  message: string;
  refId: string;
}

export interface HealthScoreResponse {
  eligible: boolean;
  score: number | null;
  domains: {
    appointments: DomainScore | null;
    results: DomainScore | null;
    referrals: DomainScore | null;
  };
  improvements: Improvement[];
}

interface BackendErrorBody {
  error?: { code?: string; message?: string };
}

export async function fetchHealthScore(idToken: string): Promise<HealthScoreResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/patients/me/health-score`, {
      method: "GET",
      headers: { Authorization: `Bearer ${idToken}` },
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("O cálculo do score demorou demais. Tente novamente.");
    }
    throw new Error("Não foi possível conectar ao backend. Verifique sua conexão e o endereço configurado (EXPO_PUBLIC_API_BASE_URL).");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errBody: BackendErrorBody | null = await response.json().catch(() => null);
    throw new Error(errBody?.error?.message ?? `Backend respondeu ${response.status}`);
  }

  return (await response.json()) as HealthScoreResponse;
}
