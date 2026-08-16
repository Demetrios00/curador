import path from "path";

import { AppError } from "../../middleware/errorHandler";
import type { ResultRecord } from "../../repositories/results.repository";
import { GET_EXAM_RESULTS_TOOL_NAME } from "../tools/getExamResults";
import { createMcpConnection } from "./mcpConnectionFactory";

/** Host + Client MCP do domínio de Resultados (Fase 6). */
const connection = createMcpConnection({
  serverEntrypoint: path.join(__dirname, "../servers/resultsMcpServer"),
  clientName: "curador-backend-results-mcp-client",
});

/** Fecha a conexão MCP de Resultados (e o subprocesso do servidor). Chamado no shutdown do backend. */
export async function closeResultsMcpClient(): Promise<void> {
  await connection.close();
}

/** Chama a ferramenta MCP `get_exam_results`. Usada pelo Agente de Resultados. */
export async function callGetExamResults(patientUid: string): Promise<ResultRecord[]> {
  const client = await connection.getClient();

  const result = await client.callTool({
    name: GET_EXAM_RESULTS_TOOL_NAME,
    arguments: { patientUid },
  });

  const content = result.content as Array<{ type: string; text?: string }> | undefined;
  const textBlock = content?.find((c) => c.type === "text");

  if (result.isError) {
    throw new AppError(
      textBlock?.text ?? "Falha ao executar a ferramenta MCP get_exam_results.",
      502,
      "MCP_TOOL_ERROR"
    );
  }

  if (!textBlock?.text) {
    throw new AppError(
      "Resposta inesperada da ferramenta MCP get_exam_results.",
      502,
      "MCP_INVALID_RESPONSE"
    );
  }

  return JSON.parse(textBlock.text) as ResultRecord[];
}
