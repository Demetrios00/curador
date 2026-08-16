import { callGetExamResults } from "../../mcp/clients/resultsMcpClient";
import type { ResultRecord } from "../../repositories/results.repository";

export interface ResultsAgentResult {
  message: string;
  mostRecent: ResultRecord | null;
  pendingCount: number;
  availableCount: number;
}

/**
 * Agente de Resultados (Fase 6).
 *
 * Responsabilidade única: informar disponibilidade e status de resultados
 * de exames — NUNCA seu conteúdo clínico. Segue literalmente o exemplo
 * permitido/proibido da Seção 10.3 do projeto:
 *   permitido: "O resultado do Hemograma realizado em 14/08 está disponível."
 *   proibido:  "Seu hemograma indica anemia."
 *
 * Por isso o repositório (`repositories/results.repository.ts`) nem chega a
 * expor o campo `summary` da coleção `results` — não é uma omissão deste
 * agente, é uma barreira uma camada abaixo, para que nenhuma mudança futura
 * aqui escape esse limite por acidente.
 */
export async function handleResultsRequest(patientUid: string): Promise<ResultsAgentResult> {
  const results = await callGetExamResults(patientUid);

  const pendingCount = results.filter((r) => r.status === "processando").length;
  const availableCount = results.filter((r) => r.status === "disponivel").length;
  const mostRecent = results[0] ?? null;

  return {
    message: buildMessage(mostRecent, availableCount, pendingCount),
    mostRecent,
    pendingCount,
    availableCount,
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function buildMessage(mostRecent: ResultRecord | null, availableCount: number, pendingCount: number): string {
  if (!mostRecent) {
    return "Você ainda não tem nenhum resultado de exame registrado.";
  }

  const dateLabel = formatDate(mostRecent.date);
  const statusLabel = mostRecent.status === "disponivel" ? "está disponível" : "ainda está em processamento";
  const fileNote = mostRecent.status === "disponivel" && mostRecent.hasFile ? " Você pode baixar o laudo pelo aplicativo." : "";

  const recentLine = `O resultado do "${mostRecent.title}" (realizado em ${dateLabel}) ${statusLabel}.${fileNote}`;

  if (availableCount + pendingCount <= 1) {
    return recentLine;
  }

  return `${recentLine} No total, você tem ${availableCount} resultado(s) disponível(is) e ${pendingCount} em processamento.`;
}
