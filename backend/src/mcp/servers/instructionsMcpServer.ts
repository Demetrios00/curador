import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  GET_EXAM_INSTRUCTIONS_TOOL_NAME,
  getExamInstructionsHandler,
  getExamInstructionsInputSchema,
} from "../tools/getExamInstructions";

/**
 * Servidor MCP de Instruções — processo Node independente, iniciado pelo
 * backend (via `mcp/clients/instructionsMcpClient.ts`) como subprocesso,
 * comunicando-se por stdio, conforme a especificação do Model Context
 * Protocol.
 *
 * Este servidor é o único lugar que conhece as coleções `examTypes`,
 * `surgeryTypes` e `instructions` para fins de orientação de preparo — o
 * Agente de Instruções (`agents/instructions/`) não acessa o Firestore
 * diretamente.
 *
 * Deliberadamente um servidor SEPARADO do de Agendamentos (não a mesma
 * ferramenta acumulada em um processo único): cada servidor MCP representa
 * um domínio de dados coeso, e um cai sem derrubar o outro.
 */
import "dotenv/config";

const server = new McpServer({
  name: "curador-instructions-mcp-server",
  version: "0.1.0",
});

/**
 * `registerTool` é chamado via um cast de tipo estreito e documentado — o
 * mesmo aplicado em `appointmentsMcpServer.ts`. Causa raiz e justificativa
 * completas lá; resumo: a assinatura genérica de `registerTool` no
 * `@modelcontextprotocol/sdk` (>=1.22) ultrapassa o limite de profundidade
 * de instanciação de tipos do TypeScript ao combinar o "raw shape" do Zod
 * com os tipos internos recursivos do próprio Zod — não é um erro deste
 * código, é uma limitação conhecida da combinação SDK + TypeScript 5.9.
 * O `inputSchema` continua validado em tempo de execução pelo SDK.
 */
(server.registerTool as (...args: unknown[]) => unknown)(
  GET_EXAM_INSTRUCTIONS_TOOL_NAME,
  {
    title: "Obter instruções de preparo",
    description:
      "Retorna a instrução de preparo operacional cadastrada para um exame ou cirurgia, identificado pelo título do procedimento.",
    inputSchema: getExamInstructionsInputSchema,
  },
  getExamInstructionsHandler
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[instructions-mcp-server] falha ao iniciar:", err);
  process.exit(1);
});
