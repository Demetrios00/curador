import { handleAppointmentsRequest } from "./appointmentsAgent";
import { classifyAppointmentAction, buildAppointmentDraft } from "./scheduleAppointment";

/**
 * Ponto de entrada único do Agente de Agendamentos para mensagens em
 * linguagem natural (chamado pelo orquestrador quando `intent === "APPOINTMENTS"`).
 *
 * Decide internamente entre as duas responsabilidades do agente:
 * - QUERY (Fases 4/5a, inalterado): `handleAppointmentsRequest` — só lê.
 * - CREATE (Ideia 5b, novo): `buildAppointmentDraft` — monta um rascunho a
 *   confirmar, nunca grava sozinho.
 *
 * Esta divisão fica FORA de `appointmentsAgent.ts` de propósito: mantém o
 * arquivo já validado nas Fases 4/5/5a intocado (menor risco de regressão)
 * e isola a responsabilidade nova (Seção 21 do projeto — funções pequenas,
 * baixo acoplamento).
 */
export async function routeAppointmentsMessage(
  patientUid: string,
  message: string
): Promise<{ agentResult: unknown; toolUsed: string }> {
  const action = await classifyAppointmentAction(message);

  if (action === "CREATE") {
    return {
      agentResult: await buildAppointmentDraft(patientUid, message),
      toolUsed: "mcp:get_scheduling_catalog",
    };
  }

  return {
    agentResult: await handleAppointmentsRequest(patientUid),
    toolUsed: "mcp:list_user_appointments",
  };
}
