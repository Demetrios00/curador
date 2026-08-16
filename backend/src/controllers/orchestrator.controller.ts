import { randomUUID } from "crypto";
import type { NextFunction, Response } from "express";

import { handleAppointmentsRequest } from "../agents/appointments/appointmentsAgent";
import { handleInstructionsRequest } from "../agents/instructions/instructionsAgent";
import { classifyIntent } from "../agents/orchestrator/classifyIntent";
import { handleResultsRequest } from "../agents/results/resultsAgent";
import { handleUnitsRequest } from "../agents/units/unitsAgent";
import type { Intent } from "../agents/orchestrator/types";
import { env } from "../config/env";
import type { AuthenticatedRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { createAgentLog } from "../repositories/agentLogs.repository";
import { logEvent } from "../utils/logger";

interface RouteRequestBody {
  message?: string;
  /**
   * Localização ATUAL do paciente — só existe no dispositivo (GPS), nunca
   * é salva no Firestore. Opcional no corpo: só é exigida quando a
   * intenção classificada é UNITS (ver `dispatchToAgent`/`parseLocation`).
   */
  location?: { latitude?: unknown; longitude?: unknown };
}

/**
 * Valida `location`, se enviado. Retorna `null` quando ausente (não é
 * erro — nem toda mensagem precisa de localização). Lança `AppError` 400
 * apenas quando `location` foi enviado mas está malformado — diferente de
 * simplesmente não ter sido enviado.
 */
function parseLocation(body: RouteRequestBody): { latitude: number; longitude: number } | null {
  if (body.location === undefined) {
    return null;
  }

  const { latitude, longitude } = body.location;

  const validLatitude = typeof latitude === "number" && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90;
  const validLongitude =
    typeof longitude === "number" && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;

  if (!validLatitude || !validLongitude) {
    throw new AppError(
      'Campo "location" inválido — esperado { latitude: number (-90 a 90), longitude: number (-180 a 180) }.',
      400,
      "INVALID_LOCATION"
    );
  }

  return { latitude: latitude as number, longitude: longitude as number };
}

/**
 * POST /api/orchestrator/route (autenticado — ver `middleware/auth.ts`)
 *
 * Fluxo do Agente Orquestrador (Seção 9 do projeto):
 * 1. recebe a mensagem;
 * 2. identifica o paciente (via `req.auth.uid`, nunca de um campo do corpo);
 * 3. classifica a intenção;
 * 4. se houver um agente especializado para essa intenção, delega a ele
 *    (Agendamentos — Fase 4; Instruções, Resultados e Unidades — Fase 6);
 * 5. consolida a resposta e registra rastreabilidade.
 *
 * O Agente de Unidades também usa `location` (latitude/longitude atuais do
 * paciente), enviado opcionalmente no corpo — é a única informação que os
 * agentes precisam além de `patientUid`, já que a localização em tempo
 * real só existe no dispositivo, nunca no Firestore.
 *
 * Desde a Fase 7, cada execução também é persistida em `agent_logs`
 * (Firestore), além do log de console já existente — ver
 * `repositories/agentLogs.repository.ts`. A gravação é "fire-and-forget"
 * (`void createAgentLog(...)`, não `await`): uma falha ou lentidão ao
 * gravar o log NUNCA deve atrasar a resposta ao paciente, e não deve
 * contaminar a própria métrica de latência que o log existe para medir
 * (Seção 15 do projeto).
 */
export async function postRoute(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const patientUid = req.auth?.uid;
  let message = "";

  try {
    if (!env.llmApiKey) {
      throw new AppError(
        "Serviço de LLM não configurado no backend. Defina LLM_API_KEY no .env.",
        500,
        "LLM_NOT_CONFIGURED"
      );
    }

    if (!patientUid) {
      // Não deveria acontecer se `requireAuth` está na frente desta rota,
      // mas não custa não confiar cegamente em middleware alheio.
      throw new AppError("Usuário não autenticado.", 401, "UNAUTHENTICATED");
    }

    const body = req.body as RouteRequestBody;
    message = body.message?.trim() ?? "";

    if (!message) {
      throw new AppError('Campo "message" é obrigatório e não pode ser vazio.', 400, "INVALID_BODY");
    }

    const location = parseLocation(body);

    const classification = await classifyIntent(message);
    const { selectedAgent, agentResult, toolUsed } = await dispatchToAgent(classification.intent, patientUid, location);
    const finishedAt = Date.now();
    const latencyMs = finishedAt - startedAt;

    logEvent("orchestrator.route", {
      requestId,
      userId: patientUid,
      intent: classification.intent,
      confidence: classification.confidence,
      selectedAgent,
      toolUsed,
      latencyMs,
      success: true,
    });

    void createAgentLog({
      requestId,
      userId: patientUid,
      userMessage: message,
      intent: classification.intent,
      confidence: classification.confidence,
      selectedAgent,
      toolUsed,
      startedAt,
      finishedAt,
      latencyMs,
      success: true,
      error: null,
    });

    res.status(200).json({
      requestId,
      intent: classification.intent,
      confidence: classification.confidence,
      agent: selectedAgent,
      result: agentResult,
    });
  } catch (err) {
    const finishedAt = Date.now();
    const latencyMs = finishedAt - startedAt;
    const errorMessage = err instanceof Error ? err.message : String(err);

    logEvent("orchestrator.route", {
      requestId,
      userId: patientUid ?? null,
      latencyMs,
      success: false,
      error: errorMessage,
    });

    void createAgentLog({
      requestId,
      userId: patientUid ?? null,
      userMessage: message,
      intent: null,
      confidence: null,
      selectedAgent: null,
      toolUsed: null,
      startedAt,
      finishedAt,
      latencyMs,
      success: false,
      error: errorMessage,
    });

    next(err);
  }
}

/**
 * Único ponto de decisão "intenção → agente". Adicionar um novo agente no
 * futuro significa só adicionar um `case` aqui — nenhum outro arquivo do
 * orquestrador muda (Seção 15 do projeto: extensibilidade).
 */
async function dispatchToAgent(
  intent: Intent,
  patientUid: string,
  location: { latitude: number; longitude: number } | null
): Promise<{ selectedAgent: string | null; agentResult: unknown; toolUsed: string | null }> {
  switch (intent) {
    case "APPOINTMENTS":
      return {
        selectedAgent: "appointments",
        agentResult: await handleAppointmentsRequest(patientUid),
        toolUsed: "mcp:list_user_appointments",
      };
    case "INSTRUCTIONS":
      return {
        selectedAgent: "instructions",
        agentResult: await handleInstructionsRequest(patientUid),
        toolUsed: "mcp:list_user_appointments,mcp:get_exam_instructions",
      };
    case "RESULTS":
      return {
        selectedAgent: "results",
        agentResult: await handleResultsRequest(patientUid),
        toolUsed: "mcp:get_exam_results",
      };
    case "UNITS":
      return {
        selectedAgent: "units",
        agentResult: await handleUnitsRequest(location),
        toolUsed: location ? "mcp:find_nearby_units" : null,
      };
    default:
      // UNKNOWN — nenhum agente corresponde.
      return { selectedAgent: null, agentResult: null, toolUsed: null };
  }
}
