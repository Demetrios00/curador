import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  GET_EXAM_RESULTS_TOOL_NAME,
  getExamResultsHandler,
  getExamResultsInputSchema,
} from "../tools/getExamResults";

/**
 * Servidor MCP de Resultados — processo Node independente, iniciado pelo
 * backend (via `mcp/clients/resultsMcpClient.ts`) como subprocesso,
 * comunicando-se por stdio.
 *
 * Único lugar que conhece a coleção `results` — o Agente de Resultados
 * (`agents/results/`) não acessa o Firestore diretamente.
 */
import "dotenv/config";

const server = new McpServer({
  name: "curador-results-mcp-server",
  version: "0.1.0",
});

/**
 * `registerTool` é chamado via cast de tipo estreito — mesmo motivo
 * documentado em `appointmentsMcpServer.ts` (limitação de profundidade de
 * instanciação de tipos do TypeScript ao combinar o "raw shape" do Zod com
 * os tipos internos recursivos do próprio Zod nas assinaturas do SDK).
 */
(server.registerTool as (...args: unknown[]) => unknown)(
  GET_EXAM_RESULTS_TOOL_NAME,
  {
    title: "Listar resultados de exames do paciente",
    description:
      "Retorna os resultados de exames (disponíveis ou em processamento) de um paciente do CuraDor, identificado por patientUid. Não inclui interpretação clínica.",
    inputSchema: getExamResultsInputSchema,
  },
  getExamResultsHandler
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[results-mcp-server] falha ao iniciar:", err);
  process.exit(1);
});
