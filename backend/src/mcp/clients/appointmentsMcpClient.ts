import path from "path";

import { AppError } from "../../middleware/errorHandler";
import { LIST_USER_APPOINTMENTS_TOOL_NAME } from "../tools/listUserAppointments";
import type { AppointmentRecord } from "../../repositories/appointments.repository";
import { createMcpConnection } from "./mcpConnectionFactory";

/**
 * Host + Client MCP do domínio de Agendamentos (Fase 5).
 *
 * Renomeado de `mcpClientManager.ts` para `appointmentsMcpClient.ts` na
 * Fase 6, ao introduzir um segundo domínio (Instruções) — o nome antigo,
 * genérico, deixou de fazer sentido quando passou a existir mais de um
 * cliente MCP no backend.
 */
const connection = createMcpConnection({
  serverEntrypoint: path.join(__dirname, "../servers/appointmentsMcpServer"),
  clientName: "curador-backend-appointments-mcp-client",
});

/** Fecha a conexão MCP de Agendamentos (e o subprocesso do servidor). Chamado no shutdown do backend. */
export async function closeAppointmentsMcpClient(): Promise<void> {
  await connection.close();
}

/**
 * Chama a ferramenta MCP `list_user_appointments`. Usada pelo Agente de
 * Agendamentos (e, desde a Fase 6, também pelo Agente de Instruções, para
 * descobrir qual é o próximo exame/cirurgia do paciente).
 */
export async function callListUserAppointments(patientUid: string): Promise<AppointmentRecord[]> {
  const client = await connection.getClient();

  const result = await client.callTool({
    name: LIST_USER_APPOINTMENTS_TOOL_NAME,
    arguments: { patientUid },
  });

  const content = result.content as Array<{ type: string; text?: string }> | undefined;
  const textBlock = content?.find((c) => c.type === "text");

  /**
   * Quando o handler da ferramenta lança um erro (ex.: Firebase Admin não
   * configurado, timeout no Firestore), o McpServer não propaga uma
   * exceção pelo transporte — ele captura o erro e devolve uma resposta
   * MCP válida com `isError: true` e o texto do erro em `content`. Se não
   * checarmos isso aqui, o código abaixo tentaria fazer `JSON.parse` de uma
   * mensagem de erro em texto livre, falhando com um `SyntaxError` confuso
   * em vez de um `AppError` claro e rastreável.
   */
  if (result.isError) {
    throw new AppError(
      textBlock?.text ?? "Falha ao executar a ferramenta MCP list_user_appointments.",
      502,
      "MCP_TOOL_ERROR"
    );
  }

  if (!textBlock?.text) {
    throw new AppError(
      "Resposta inesperada da ferramenta MCP list_user_appointments.",
      502,
      "MCP_INVALID_RESPONSE"
    );
  }

  return JSON.parse(textBlock.text) as AppointmentRecord[];
}
