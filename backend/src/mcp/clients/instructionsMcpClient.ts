import path from "path";

import { AppError } from "../../middleware/errorHandler";
import type { InstructionRecord } from "../../repositories/instructions.repository";
import { GET_EXAM_INSTRUCTIONS_TOOL_NAME } from "../tools/getExamInstructions";
import { createMcpConnection } from "./mcpConnectionFactory";

/** Host + Client MCP do domínio de Instruções (Fase 6). */
const connection = createMcpConnection({
  serverEntrypoint: path.join(__dirname, "../servers/instructionsMcpServer"),
  clientName: "curador-backend-instructions-mcp-client",
});

/** Fecha a conexão MCP de Instruções (e o subprocesso do servidor). Chamado no shutdown do backend. */
export async function closeInstructionsMcpClient(): Promise<void> {
  await connection.close();
}

/**
 * Chama a ferramenta MCP `get_exam_instructions`. Usada pelo Agente de
 * Instruções depois de já saber qual procedimento (título + escopo) o
 * paciente tem agendado — essa descoberta acontece no próprio agente,
 * reaproveitando `callListUserAppointments` (Fase 5).
 */
export async function callGetExamInstructions(
  procedureTitle: string,
  scope: "exam" | "surgery"
): Promise<InstructionRecord | null> {
  const client = await connection.getClient();

  const result = await client.callTool({
    name: GET_EXAM_INSTRUCTIONS_TOOL_NAME,
    arguments: { procedureTitle, scope },
  });

  const content = result.content as Array<{ type: string; text?: string }> | undefined;
  const textBlock = content?.find((c) => c.type === "text");

  if (result.isError) {
    throw new AppError(
      textBlock?.text ?? "Falha ao executar a ferramenta MCP get_exam_instructions.",
      502,
      "MCP_TOOL_ERROR"
    );
  }

  if (!textBlock?.text) {
    throw new AppError(
      "Resposta inesperada da ferramenta MCP get_exam_instructions.",
      502,
      "MCP_INVALID_RESPONSE"
    );
  }

  // `null` é uma resposta válida (nenhuma instrução cadastrada para o
  // procedimento) — só o JSON malformado seria um erro, e isso já teria
  // sido pego pelo `try/catch` implícito do `JSON.parse`.
  return JSON.parse(textBlock.text) as InstructionRecord | null;
}
