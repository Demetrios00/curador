import { callListUserAppointments } from "../../mcp/clients/appointmentsMcpClient";
import { callGetExamInstructions } from "../../mcp/clients/instructionsMcpClient";
import type { AppointmentRecord } from "../../repositories/appointments.repository";
import type { InstructionRecord } from "../../repositories/instructions.repository";

export interface InstructionsAgentResult {
  message: string;
  procedure: { title: string; date: string } | null;
  instruction: InstructionRecord | null;
}

/**
 * Agente de Instruções (Fase 6).
 *
 * Responsabilidade única: dado um paciente, descobrir seu próximo
 * exame/cirurgia agendado e devolver a orientação de preparo cadastrada
 * para ele. Nunca produz orientação clínica — apenas repassa texto
 * operacional previamente cadastrado (Seção 10.2 do projeto).
 *
 * Reaproveita DUAS ferramentas MCP de domínios diferentes:
 *  1. `list_user_appointments` (servidor de Agendamentos, Fase 5) — para
 *     descobrir QUAL procedimento responder, sem o usuário precisar
 *     nomear o exame na mensagem (resolve "meu exame", como no exemplo da
 *     Seção 9 do projeto).
 *  2. `get_exam_instructions` (servidor de Instruções, Fase 6) — para
 *     obter a orientação cadastrada para esse procedimento.
 *
 * Este é o ponto que demonstra a diferença entre ORQUESTRAÇÃO (este
 * agente decidindo, em código, chamar duas ferramentas em sequência e
 * combinar os resultados) e MCP (o protocolo padronizado usado para cada
 * uma dessas chamadas) — a distinção conceitual exigida na Seção 8 do
 * projeto.
 */
export async function handleInstructionsRequest(patientUid: string): Promise<InstructionsAgentResult> {
  const appointments = await callListUserAppointments(patientUid);
  const nextProcedure = findNextExamOrSurgery(appointments);

  if (!nextProcedure) {
    return {
      message: "Você não tem nenhum exame ou cirurgia agendado no momento para eu buscar instruções de preparo.",
      procedure: null,
      instruction: null,
    };
  }

  const scope: "exam" | "surgery" = nextProcedure.type === "exame" ? "exam" : "surgery";
  const instruction = await callGetExamInstructions(nextProcedure.title, scope);

  const procedure = { title: nextProcedure.title, date: nextProcedure.date };

  if (!instruction) {
    return {
      message: `Você tem "${nextProcedure.title}" agendado, mas ainda não há instruções de preparo cadastradas para esse procedimento. Recomendo confirmar diretamente com a unidade de saúde.`,
      procedure,
      instruction: null,
    };
  }

  return {
    message: instruction.instructionsText,
    procedure,
    instruction,
  };
}

/** Próximo agendamento futuro cujo tipo é "exame" ou "cirurgia" (não considera "consulta"/"online" — não fazem parte de Instruções). */
function findNextExamOrSurgery(appointments: AppointmentRecord[]): AppointmentRecord | null {
  const now = Date.now();

  const upcoming = appointments
    .filter((a) => (a.type === "exame" || a.type === "cirurgia") && new Date(a.date).getTime() >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return upcoming[0] ?? null;
}
