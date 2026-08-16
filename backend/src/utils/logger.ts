/**
 * Logger estruturado mínimo (console, JSON por linha).
 *
 * Não é a coleção `agent_logs` do Firestore (isso é a Fase 7 — precisa antes
 * ser apresentada/aprovada, conforme a Seção 13 do projeto). Serve apenas
 * para tornar o roteamento do orquestrador observável desde já: dá para
 * acompanhar `requestId`, intenção e latência no terminal do backend.
 */
export function logEvent(event: string, data: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      ...data,
    })
  );
}
