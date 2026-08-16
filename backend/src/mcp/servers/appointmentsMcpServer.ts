import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  LIST_USER_APPOINTMENTS_TOOL_NAME,
  listUserAppointmentsHandler,
  listUserAppointmentsInputSchema,
} from "../tools/listUserAppointments";

/**
 * Servidor MCP de Agendamentos — processo Node independente, iniciado pelo
 * backend (via `mcp/clients/mcpClientManager.ts`) como subprocesso,
 * comunicando-se por stdio (entrada/saída padrão), conforme a especificação
 * do Model Context Protocol.
 *
 * Este servidor é o único lugar que conhece o Firestore para o domínio de
 * agendamentos — o Agente de Agendamentos (`agents/appointments/`) não
 * importa mais `repositories/appointments.repository.ts` diretamente.
 *
 * Executado isoladamente (fora do processo principal do Express), então
 * repete sua própria carga de variáveis de ambiente.
 */
import "dotenv/config";

const server = new McpServer({
  name: "curador-appointments-mcp-server",
  version: "0.1.0",
});

/**
 * `registerTool` é chamado via um cast de tipo estreito e documentado.
 *
 * Causa raiz (não é um erro do nosso código): a assinatura genérica de
 * `registerTool<OutputArgs, InputArgs>` no @modelcontextprotocol/sdk (>=1.22)
 * combina, em um único tipo condicional (`ToolCallback`/`BaseToolCallback`),
 * o "raw shape" do Zod (`Record<string, AnySchema>`) com os tipos internos
 * recursivos do próprio Zod (`ZodTypeAny`/`$ZodType`). Ao checar
 * `{ patientUid: z.ZodString }` contra essa união condicional, o compilador
 * ultrapassa o limite interno de profundidade de instanciação de tipos do
 * TypeScript e falha com `TS2589 (Type instantiation is excessively deep)`
 * — reproduzido de forma isolada (arquivo mínimo, fora deste projeto) e
 * confirmado como limitação da combinação SDK 1.22–1.30 + TypeScript 5.9,
 * não uma incompatibilidade de versão do Zod (testado com uma única versão
 * de `zod` deduplicada em toda a árvore de dependências).
 *
 * O cast abaixo restringe a perda de segurança de tipos exclusivamente à
 * chamada de `registerTool` em si — o `inputSchema` continua sendo validado
 * em tempo de execução pelo próprio SDK (é ele quem faz o parse via Zod
 * antes de invocar o handler) e `listUserAppointmentsHandler` mantém sua
 * assinatura própria, explícita e checada (`{ patientUid: string }` →
 * `Promise<...>`), definida em `mcp/tools/listUserAppointments.ts`.
 */
(server.registerTool as (...args: unknown[]) => unknown)(
  LIST_USER_APPOINTMENTS_TOOL_NAME,
  {
    title: "Listar agendamentos do paciente",
    description:
      "Retorna os agendamentos (consultas, exames, cirurgias) de um paciente do CuraDor, identificado por patientUid.",
    inputSchema: listUserAppointmentsInputSchema,
  },
  listUserAppointmentsHandler
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[appointments-mcp-server] falha ao iniciar:", err);
  process.exit(1);
});
