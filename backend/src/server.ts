import { createApp } from "./app";
import { env } from "./config/env";
import { closeAppointmentsMcpClient } from "./mcp/clients/appointmentsMcpClient";
import { closeInstructionsMcpClient } from "./mcp/clients/instructionsMcpClient";
import { closeResultsMcpClient } from "./mcp/clients/resultsMcpClient";
import { closeUnitsMcpClient } from "./mcp/clients/unitsMcpClient";

/**
 * Rede de segurança contra erros assíncronos que escapam do
 * try/catch de um request (ex.: falhas de conexão em clientes que mantêm
 * streams/canais próprios, como o Firestore Admin SDK). Sem isto, um erro
 * de rede em UMA chamada externa derruba o processo inteiro — inclusive
 * `/health` — o que quebraria a robustez que o TCC avalia (Seção 15:
 * "o fluxo funciona ponta a ponta?"). Apenas logamos e mantemos o
 * servidor no ar; não é substituto para corrigir a causa raiz quando
 * identificada.
 */
process.on("unhandledRejection", (reason) => {
  console.error("[unhandled-rejection]", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[uncaught-exception]", err);
});

const app = createApp();

const httpServer = app.listen(env.port, () => {
  console.log(`[curador-backend] rodando em http://localhost:${env.port} (${env.nodeEnv})`);
  console.log(`[curador-backend] health check: http://localhost:${env.port}/health`);
});

/**
 * Encerramento gracioso: fecha as conexões MCP (e os subprocessos dos
 * quatro servidores — Agendamentos, Instruções, Resultados e Unidades)
 * antes de sair. Sem isso, os subprocessos ficariam órfãos a cada
 * reinício do backend em desenvolvimento.
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`[curador-backend] recebido ${signal}, encerrando...`);
  await Promise.all([
    closeAppointmentsMcpClient(),
    closeInstructionsMcpClient(),
    closeResultsMcpClient(),
    closeUnitsMcpClient(),
  ]);
  httpServer.close(() => process.exit(0));
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
