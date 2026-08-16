import { getAdminFirestore } from "../firebase/admin";
import { withTimeout } from "../utils/withTimeout";

/**
 * Schema da coleção `agent_logs` (Fase 7 — campos exatamente conforme a
 * Seção 14 do projeto). Existe para apoiar a AVALIAÇÃO da arquitetura
 * multiagente (Seção 15: taxa de roteamento correto, latência, taxa de
 * sucesso) — não para armazenar dados de saúde indiscriminadamente.
 *
 * Decisão registrada (para defesa perante a banca, se questionada):
 * `userMessage` é gravado porque a Seção 14 lista esse campo explicitamente
 * ("quando apropriado") e a Seção 15 exige avaliar "taxa de roteamento
 * correto" — isso não é possível sem o texto da mensagem original, para
 * comparar a intenção classificada com a intenção real. Nenhum outro dado
 * de saúde (resultados, laudos, prescrições) é gravado aqui — apenas
 * metadados de execução e o texto da pergunta do paciente.
 */
export interface AgentLogEntry {
  requestId: string;
  userId: string | null;
  userMessage: string;
  intent: string | null;
  confidence: number | null;
  selectedAgent: string | null;
  toolUsed: string | null;
  startedAt: number;
  finishedAt: number;
  latencyMs: number;
  success: boolean;
  error: string | null;
}

/**
 * Persiste um registro de execução na coleção `agent_logs`. NUNCA lança
 * erro para o chamador — uma falha ao gravar o log não pode derrubar nem
 * atrasar a resposta ao paciente (mesmo espírito das demais redes de
 * segurança do backend). A falha, se ocorrer, é apenas registrada no
 * console.
 */
export async function createAgentLog(entry: AgentLogEntry): Promise<void> {
  try {
    await withTimeout(
      getAdminFirestore()
        .collection("agent_logs")
        .add({ ...entry, createdAt: Date.now() }),
      5000,
      "agentLogs.create"
    );
  } catch (err) {
    console.error("[agent_logs] falha ao persistir log (resposta ao usuário não foi afetada):", err instanceof Error ? err.message : err);
  }
}

export interface AgentLogRecord extends AgentLogEntry {
  id: string;
}

/** Lê os `limit` registros mais recentes — usado pelo endpoint de resumo/avaliação (ver `agentLogsSummary.controller.ts`). */
export async function listRecentAgentLogs(limit = 200): Promise<AgentLogRecord[]> {
  const snapshot = await withTimeout(
    getAdminFirestore().collection("agent_logs").orderBy("createdAt", "desc").limit(limit).get(),
    8000,
    "agentLogs.listRecent"
  );

  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as AgentLogEntry) }));
}
