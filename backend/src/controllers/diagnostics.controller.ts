import type { NextFunction, Request, Response } from "express";

import { countHospitals, listHospitalsSample } from "../repositories/hospitals.repository";
import { withTimeout } from "../utils/withTimeout";

/**
 * GET /api/_internal/firebase-check
 *
 * Endpoint de diagnóstico da Fase 1 — Passo 2. Não faz parte da API de
 * domínio do app; existe só para validar, uma vez, que o backend consegue
 * autenticar no Firebase Admin e ler o Firestore com as credenciais reais.
 * Pode ser removido (ou protegido) quando os repositórios de domínio
 * entrarem em uso nas Fases 3/4.
 */
export async function getFirebaseCheck(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [count, sample] = await withTimeout(
      Promise.all([countHospitals(), listHospitalsSample()]),
      8000,
      "firebase-check"
    );
    res.status(200).json({
      status: "ok",
      collection: "hospitals",
      count,
      sample,
    });
  } catch (err) {
    next(err);
  }
}
