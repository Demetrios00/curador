import { z } from "zod";

import { findInstructionsByProcedureTitle } from "../../repositories/instructions.repository";

/**
 * Definição da ferramenta MCP `get_exam_instructions`.
 *
 * Recebe o TÍTULO do procedimento (não um ID — ver
 * `repositories/instructions.repository.ts` para o motivo) e o escopo
 * (exame ou cirurgia). Quem decide qual título/escopo perguntar é o Agente
 * de Instruções (Host) — este servidor não sabe nada sobre agendamentos ou
 * pacientes, apenas resolve "dado este procedimento, qual é a instrução?".
 */
export const GET_EXAM_INSTRUCTIONS_TOOL_NAME = "get_exam_instructions";

export const getExamInstructionsInputSchema = {
  procedureTitle: z
    .string()
    .min(1)
    .describe("Título do procedimento (exame ou cirurgia), exatamente como aparece no agendamento do paciente."),
  scope: z.enum(["exam", "surgery"]).describe("Se o procedimento é um exame ou uma cirurgia."),
};

export async function getExamInstructionsHandler({
  procedureTitle,
  scope,
}: {
  procedureTitle: string;
  scope: "exam" | "surgery";
}) {
  const instruction = await findInstructionsByProcedureTitle(procedureTitle, scope);

  // `instruction` pode ser `null` (nenhuma instrução cadastrada) — é uma
  // resposta de domínio válida, não um erro; o Agente de Instruções decide
  // a mensagem apropriada para esse caso.
  return {
    content: [{ type: "text" as const, text: JSON.stringify(instruction) }],
  };
}
