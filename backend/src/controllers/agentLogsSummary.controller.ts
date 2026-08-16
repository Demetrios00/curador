import type { NextFunction, Request, Response } from "express";

import { listRecentAgentLogs } from "../repositories/agentLogs.repository";
import { withTimeout } from "../utils/withTimeout";

/**
 * GET /api/_internal/agent-logs/summary
 *
 * Endpoint de diagnóstico (não é API de domínio) que agrega os registros
 * de `agent_logs` em métricas simples — apoio direto à Seção 15 do
 * projeto ("taxa de roteamento correto", "latência total", "quantidade de
 * erros", "taxa de execução bem-sucedida").
 *
 * IMPORTANTE (mesma cautela da Seção 15): este é um agregado descritivo
 * sobre os logs existentes, não um resultado experimental com metodologia
 * controlada — não deve ser apresentado como tal na banca. Serve para
 * observar a arquitetura em funcionamento, não para provar hipóteses
 * científicas.
 */
export async function getAgentLogsSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limitParam = Number(req.query.limit);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 1000) : 200;

    const logs = await withTimeout(listRecentAgentLogs(limit), 8000, "agentLogsSummary");

    const totalRequests = logs.length;
    const successCount = logs.filter((l) => l.success).length;
    const errorCount = totalRequests - successCount;

    const countByIntent: Record<string, number> = {};
    const countBySelectedAgent: Record<string, number> = {};

    for (const log of logs) {
      const intentKey = log.intent ?? "(nenhuma — falha antes da classificação)";
      countByIntent[intentKey] = (countByIntent[intentKey] ?? 0) + 1;

      const agentKey = log.selectedAgent ?? "(nenhum agente — UNKNOWN ou falha)";
      countBySelectedAgent[agentKey] = (countBySelectedAgent[agentKey] ?? 0) + 1;
    }

    const averageLatencyMs =
      totalRequests > 0 ? Math.round(logs.reduce((sum, l) => sum + l.latencyMs, 0) / totalRequests) : 0;

    res.status(200).json({
      sampleSize: totalRequests,
      successCount,
      errorCount,
      successRate: totalRequests > 0 ? Number((successCount / totalRequests).toFixed(4)) : null,
      averageLatencyMs,
      countByIntent,
      countBySelectedAgent,
    });
  } catch (err) {
    next(err);
  }
}
