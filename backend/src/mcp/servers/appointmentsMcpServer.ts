import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  LIST_USER_APPOINTMENTS_TOOL_NAME,
  listUserAppointmentsHandler,
  listUserAppointmentsInputSchema,
} from "../tools/listUserAppointments";
import {
  GET_SCHEDULING_CATALOG_TOOL_NAME,
  getSchedulingCatalogHandler,
  getSchedulingCatalogInputSchema,
} from "../tools/getSchedulingCatalog";
import {
  CREATE_APPOINTMENT_TOOL_NAME,
  createAppointmentHandler,
  createAppointmentInputSchema,
} from "../tools/createAppointment";

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
 *
 * Ideia 5b (02/09/2026): ganhou 2 ferramentas novas — `get_scheduling_catalog`
 * (leitura) e `create_appointment` (ESCRITA — a primeira do projeto). Mesmo
 * servidor/processo dos demais, só mais ferramentas registradas (Fase 5:
 * "não criar dezenas de ferramentas" — continuam 4, agora 3 novas ao longo
 * do projeto todo, todas no mesmo servidor de domínio quando fazem sentido
 * juntas).
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
 * antes de invocar o handler) e cada handler mantém sua assinatura própria,
 * explícita e checada, definida em `mcp/tools/*.ts`.
 *
 * `.bind(server)` é OBRIGATÓRIO aqui, não cosmético: `server.registerTool`
 * usa `this` internamente (o SDK lê `this._registeredTools`). Guardar o
 * método numa constante SEM vinculá-lo primeiro — como esta linha fazia até
 * 03/09/2026 — o transforma numa chamada de função solta na hora de invocar
 * (`registerToolUnsafe(...)`, não `server.registerTool(...)`), perdendo o
 * `this` (vira `undefined` em módulo ES/strict mode). Resultado real
 * observado: o subprocesso do servidor MCP derrubava com
 * `TypeError: Cannot read properties of undefined (reading '_registeredTools')`
 * assim que uma SEGUNDA ferramenta era registrada (a introduzida pela Ideia
 * 5b) — o registro único de antes nunca expôs o problema porque não havia
 * como comparar com uma chamada correta ao lado.
 */
const registerToolUnsafe = (server.registerTool as (...args: unknown[]) => unknown).bind(server);

registerToolUnsafe(
  LIST_USER_APPOINTMENTS_TOOL_NAME,
  {
    title: "Listar agendamentos do paciente",
    description:
      "Retorna os agendamentos (consultas, exames, cirurgias) de um paciente do CuraDor, identificado por patientUid.",
    inputSchema: listUserAppointmentsInputSchema,
  },
  listUserAppointmentsHandler
);

registerToolUnsafe(
  GET_SCHEDULING_CATALOG_TOOL_NAME,
  {
    title: "Consultar catálogo de agendamento",
    description:
      "Retorna unidades, especialidades, médicos, tipos de exame e tipos de cirurgia cadastrados — usado para resolver nomes ditos em linguagem natural contra o cadastro real antes de criar um agendamento.",
    inputSchema: getSchedulingCatalogInputSchema,
  },
  getSchedulingCatalogHandler
);

registerToolUnsafe(
  CREATE_APPOINTMENT_TOOL_NAME,
  {
    title: "Criar agendamento (escrita)",
    description:
      "Grava um novo agendamento no Firestore para o paciente informado, após confirmação explícita do usuário. Refaz a checagem de conflito de horário imediatamente antes de gravar.",
    inputSchema: createAppointmentInputSchema,
  },
  createAppointmentHandler
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[appointments-mcp-server] falha ao iniciar:", err);
  process.exit(1);
});
