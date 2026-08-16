import path from "path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { env } from "../../config/env";
import { AppError } from "../../middleware/errorHandler";
import { LIST_USER_APPOINTMENTS_TOOL_NAME } from "../tools/listUserAppointments";
import type { AppointmentRecord } from "../../repositories/appointments.repository";

/**
 * Gerencia a conexão (host + client MCP) com o servidor de Agendamentos.
 *
 * A conexão é criada uma única vez, na primeira chamada, e reaproveitada
 * nas seguintes — reconectar (e reabrir um subprocesso) a cada requisição
 * HTTP seria desnecessariamente lento e não é como o MCP é normalmente
 * usado (um host mantém sessão com o servidor).
 */
let clientPromise: Promise<Client> | null = null;

function resolveServerCommand(): { command: string; args: string[] } {
  // Produção: o servidor MCP roda a partir do JavaScript já compilado (`npm run build`).
  if (env.nodeEnv === "production") {
    return {
      command: process.execPath,
      args: [path.join(__dirname, "../servers/appointmentsMcpServer.js")],
    };
  }

  // Desenvolvimento: roda o .ts diretamente via ts-node, sem exigir build a cada mudança.
  return {
    command: process.execPath,
    args: [
      "-r",
      "ts-node/register/transpile-only",
      path.join(__dirname, "../servers/appointmentsMcpServer.ts"),
    ],
  };
}

async function createClient(): Promise<Client> {
  const { command, args } = resolveServerCommand();

  const transport = new StdioClientTransport({
    command,
    args,
    env: process.env as Record<string, string>,
  });

  const client = new Client({ name: "curador-backend-mcp-client", version: "0.1.0" });
  await client.connect(transport);
  return client;
}

async function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = createClient().catch((err) => {
      // Se a conexão falhar, não deixamos uma Promise rejeitada "presa" —
      // a próxima chamada tenta reconectar em vez de falhar para sempre.
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

/** Fecha a conexão MCP (e o subprocesso do servidor). Chamado no shutdown do backend. */
export async function closeMcpClient(): Promise<void> {
  if (!clientPromise) return;
  try {
    const client = await clientPromise;
    await client.close();
  } catch {
    // Já pode estar fechado/derrubado — não é um erro relevante no shutdown.
  } finally {
    clientPromise = null;
  }
}

/**
 * Chama a ferramenta MCP `list_user_appointments`. Usada pelo Agente de
 * Agendamentos no lugar de importar o repositório do Firestore
 * diretamente (ver `agents/appointments/appointmentsAgent.ts`).
 */
export async function callListUserAppointments(patientUid: string): Promise<AppointmentRecord[]> {
  const client = await getClient();

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
