import { randomUUID } from "crypto";
import type { NextFunction, Response } from "express";

import { routeAppointmentsMessage } from "../agents/appointments/appointmentsRouter";
import { confirmAppointmentDraft, buildAppointmentDraft, parsePendingContext, isSchedulingContinuation } from "../agents/appointments/scheduleAppointment";
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

// Nota: a intenção APPOINTMENTS não chama mais `handleAppointmentsRequest`
// diretamente daqui — ele continua existindo, inalterado, em
// `agents/appointments/appointmentsAgent.ts` (consulta, Fases 4/5a), mas
// quem decide entre consultar e criar (Ideia 5b) é `routeAppointmentsMessage`.

interface RouteRequestBody {
  message?: string;
  /**
   * Localização ATUAL do paciente — só existe no dispositivo (GPS), nunca
   * é salva no Firestore. Opcional no corpo: só é exigida quando a
   * intenção classificada é UNITS (ver `dispatchToAgent`/`parseLocation`).
   */
  location?: { latitude?: unknown; longitude?: unknown };
  /**
   * Ideia 5b (02/09/2026) — MUDANÇA DE CONTRATO: quando presente, este
   * corpo NÃO passa pelo classificador de intenção nem por nenhum agente
   * além do de Agendamentos. É o único jeito de um agendamento ser
   * efetivamente gravado — o app reenvia, sem alteração, o mesmo
   * `AppointmentDraft` que recebeu numa resposta anterior com
   * `requiresConfirmation: true` (ver `agents/appointments/scheduleAppointment.ts`).
   * Mutuamente exclusivo com `message`: quando `confirmDraft` está
   * presente, `message` é ignorado.
   */
  confirmDraft?: unknown;
  /** Continuidade (18/10): pedido de agendamento incompleto devolvido pelo app. */
  pendingContext?: unknown;
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
 *
 * Ideia 5b (02/09/2026): quando o corpo traz `confirmDraft`, o fluxo acima
 * é desviado por completo — não há classificação de intenção nem escolha
 * de agente, porque a decisão "isso é um agendamento" já foi tomada na
 * chamada anterior (a que gerou o rascunho). Isso é deliberado: a
 * confirmação de uma escrita não deve depender de a LLM reinterpretar
 * texto livre de novo.
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

    // Ideia 5b: caminho de confirmação de agendamento — não usa `message`
    // nem `classifyIntent`. Ver documentação do JSDoc acima.
    if (body.confirmDraft !== undefined) {
      const agentResult = await confirmAppointmentDraft(patientUid, body.confirmDraft);
      const finishedAt = Date.now();
      const latencyMs = finishedAt - startedAt;

      logEvent("orchestrator.route", {
        requestId,
        userId: patientUid,
        intent: "APPOINTMENTS",
        confidence: 1,
        selectedAgent: "appointments",
        toolUsed: "mcp:create_appointment",
        latencyMs,
        success: true,
      });

      void createAgentLog({
        requestId,
        userId: patientUid,
        userMessage: "[confirmDraft]",
        intent: "APPOINTMENTS",
        confidence: 1,
        selectedAgent: "appointments",
        toolUsed: "mcp:create_appointment",
        startedAt,
        finishedAt,
        latencyMs,
        success: true,
        error: null,
      });

      res.status(200).json({
        requestId,
        intent: "APPOINTMENTS",
        confidence: 1,
        agent: "appointments",
        result: agentResult,
      });
      return;
    }

    message = body.message?.trim() ?? "";

    if (!message) {
      throw new AppError('Campo "message" é obrigatório e não pode ser vazio.', 400, "INVALID_BODY");
    }

    const location = parseLocation(body);

    // Continuidade de conversa (18/10/2026): se o app devolveu um pedido de
    // agendamento incompleto e a nova mensagem parece completá-lo, a
    // classificação de intenção é dispensada (o domínio já é conhecido) e o
    // texto acumulado vai direto para a extração de campos do Agente de
    // Agendamentos. O servidor continua sem estado de conversa.
    const pending = parsePendingContext(body.pendingContext);
    let classification: { intent: Intent; confidence: number };
    let selectedAgent: string | null;
    let agentResult: unknown;
    let toolUsed: string | null;
    if (pending && isSchedulingContinuation(message)) {
      classification = { intent: "APPOINTMENTS", confidence: 1 };
      selectedAgent = "appointments";
      agentResult = await buildAppointmentDraft(patientUid, `${pending.text}\n${message}`);
      toolUsed = "mcp:get_scheduling_catalog";
    } else {
      classification = await classifyIntent(message);
      ({ selectedAgent, agentResult, toolUsed } = await dispatchToAgent(classification.intent, patientUid, message, location));
    }
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
 *
 * Ideia 5b: o `case "APPOINTMENTS"` passou a delegar a
 * `routeAppointmentsMessage`, que decide internamente entre consultar
 * (Fases 4/5a) e montar um rascunho de criação (Ideia 5b) — o orquestrador
 * em si não sabe (nem precisa saber) que essa decisão interna existe.
 */
async function dispatchToAgent(
  intent: Intent,
  patientUid: string,
  message: string,
  location: { latitude: number; longitude: number } | null
): Promise<{ selectedAgent: string | null; agentResult: unknown; toolUsed: string | null }> {
  switch (intent) {
    case "APPOINTMENTS": {
      const { agentResult, toolUsed } = await routeAppointmentsMessage(patientUid, message);
      return { selectedAgent: "appointments", agentResult, toolUsed };
    }
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
