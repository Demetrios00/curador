import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env";
import { HEALTH_ASSISTANT_SYSTEM_PROMPT, llmProvider } from "../llm";
import type { ChatMessage } from "../llm/types";
import { AppError } from "../middleware/errorHandler";

interface ChatRequestBody {
  messages?: { role: string; content: string }[];
}

/**
 * POST /api/chat
 *
 * Único ponto de contato do app mobile com a LLM. O app nunca fala com a
 * OpenRouter diretamente — apenas com este endpoint, que guarda a chave e o
 * prompt de sistema no servidor.
 *
 * Ainda não há orquestração de intenção aqui (isso é a Fase 3 — Orquestrador).
 * Este endpoint apenas substitui, de forma segura, a chamada que antes o
 * app mobile fazia diretamente à OpenRouter.
 */
export async function postChat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!env.llmApiKey) {
      throw new AppError(
        "Serviço de LLM não configurado no backend. Defina LLM_API_KEY no .env.",
        500,
        "LLM_NOT_CONFIGURED"
      );
    }

    const body = req.body as ChatRequestBody;
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      throw new AppError('Campo "messages" é obrigatório e não pode ser vazio.', 400, "INVALID_BODY");
    }

    const history: ChatMessage[] = body.messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? ""),
    }));

    const reply = await llmProvider.complete([
      { role: "system", content: HEALTH_ASSISTANT_SYSTEM_PROMPT },
      ...history,
    ]);

    res.status(200).json({ reply });
  } catch (err) {
    next(err);
  }
}
