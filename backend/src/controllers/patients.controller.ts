import type { NextFunction, Response } from "express";

import type { AuthenticatedRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { computeHealthScore } from "../services/healthScore.service";

/**
 * GET /api/patients/me/health-score (autenticado — ver `middleware/auth.ts`)
 *
 * Ideia 4b (claude/ideia4b-score-saude-dia-proposta.md). Identifica o
 * paciente por `req.auth.uid` (nunca por parâmetro da URL/corpo — mesmo
 * princípio de `orchestrator.controller.ts`), delega o cálculo a
 * `healthScore.service.ts` e devolve o resultado. Nenhuma lógica de
 * negócio aqui — este controller só traduz HTTP ↔ serviço.
 */
export async function getHealthScore(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const patientUid = req.auth?.uid;
    if (!patientUid) {
      throw new AppError("Usuário não autenticado.", 401, "UNAUTHENTICATED");
    }

    const result = await computeHealthScore(patientUid);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
