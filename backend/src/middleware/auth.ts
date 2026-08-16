import type { NextFunction, Request, Response } from "express";

import { getAdminAuth } from "../firebase/admin";
import { withTimeout } from "../utils/withTimeout";
import { AppError } from "./errorHandler";

/**
 * Requisição autenticada — `auth.uid` é o identificador do paciente,
 * extraído do ID token do Firebase, nunca de um campo enviado livremente
 * no corpo da requisição (isso permitiria qualquer cliente ler dados de
 * qualquer paciente só trocando um valor no JSON).
 */
export interface AuthenticatedRequest extends Request {
  auth?: { uid: string };
}

/**
 * Middleware de autenticação: exige um ID token do Firebase válido no
 * header `Authorization: Bearer <token>`. O app mobile já obtém esse token
 * via `user.getIdToken()` (Firebase Auth client SDK) — o mesmo usuário
 * logado que já existe em `AuthContext.tsx`.
 */
export async function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

    if (!token) {
      throw new AppError(
        "Token de autenticação ausente. Envie o ID token do Firebase no header Authorization: Bearer <token>.",
        401,
        "UNAUTHENTICATED"
      );
    }

    // Verificar o token busca as chaves públicas do Google na primeira vez
    // (fica em cache depois) — outra chamada de rede externa, então também
    // protegida por timeout, pelo mesmo motivo do Firestore e da LLM.
    const decoded = await withTimeout(getAdminAuth().verifyIdToken(token), 8000, "auth.verifyIdToken");
    req.auth = { uid: decoded.uid };
    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    console.error("[auth] falha ao verificar ID token:", err);
    next(new AppError("Token de autenticação inválido ou expirado.", 401, "UNAUTHENTICATED"));
  }
}
