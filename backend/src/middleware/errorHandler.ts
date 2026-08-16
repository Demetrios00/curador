import type { NextFunction, Request, Response } from "express";

/**
 * Erro de aplicação com status HTTP explícito.
 * Serviços/controllers devem lançar este tipo em vez de `Error` genérico
 * sempre que o status HTTP correto for conhecido (ex.: 404, 400, 401).
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = "INTERNAL_ERROR"
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Middleware para rotas inexistentes — deve ser registrado após todas as rotas. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
    },
  });
}

/** Middleware global de tratamento de erros — deve ser o último `app.use()`. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  // Erro não tratado/inesperado — não vaza detalhes internos ao cliente.
  console.error("[unhandled-error]", err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Erro interno no servidor." },
  });
}
