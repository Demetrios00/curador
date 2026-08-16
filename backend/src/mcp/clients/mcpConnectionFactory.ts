import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { env } from "../../config/env";

/**
 * Fábrica de conexões MCP via stdio (Host + Client), reaproveitada por todo
 * cliente de domínio (Agendamentos, Instruções, e os que vierem depois —
 * Resultados, Unidades — Fase 6).
 *
 * Isola exatamente a parte que se repetiria em cada cliente: resolver o
 * comando do subprocesso do servidor (ts-node em desenvolvimento, Node
 * compilado em produção) e gerenciar o ciclo de vida da conexão (criar uma
 * única vez, reaproveitar entre chamadas, permitir reconexão se cair,
 * fechar de forma limpa no shutdown do backend).
 *
 * Cada domínio continua com seu próprio servidor MCP (processo separado) e
 * seu próprio cliente — esta fábrica não os une, só evita duplicar a
 * lógica de conexão em cada um.
 */
export interface McpConnection {
  getClient(): Promise<Client>;
  close(): Promise<void>;
}

export function createMcpConnection(options: {
  /** Caminho absoluto do arquivo do servidor MCP, SEM extensão (ex.: `.../mcp/servers/appointmentsMcpServer`). */
  serverEntrypoint: string;
  /** Nome do cliente MCP — aparece no handshake do protocolo, útil para depuração. */
  clientName: string;
}): McpConnection {
  let clientPromise: Promise<Client> | null = null;

  function resolveServerCommand(): { command: string; args: string[] } {
    if (env.nodeEnv === "production") {
      return { command: process.execPath, args: [`${options.serverEntrypoint}.js`] };
    }

    return {
      command: process.execPath,
      args: ["-r", "ts-node/register/transpile-only", `${options.serverEntrypoint}.ts`],
    };
  }

  async function createClient(): Promise<Client> {
    const { command, args } = resolveServerCommand();

    const transport = new StdioClientTransport({
      command,
      args,
      env: process.env as Record<string, string>,
    });

    const client = new Client({ name: options.clientName, version: "0.1.0" });
    await client.connect(transport);
    return client;
  }

  async function getClient(): Promise<Client> {
    if (!clientPromise) {
      clientPromise = createClient().catch((err) => {
        // Não deixamos uma Promise rejeitada "presa" — a próxima chamada
        // tenta reconectar em vez de falhar para sempre.
        clientPromise = null;
        throw err;
      });
    }
    return clientPromise;
  }

  async function close(): Promise<void> {
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

  return { getClient, close };
}
