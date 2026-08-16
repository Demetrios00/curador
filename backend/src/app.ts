import cors from "cors";
import express from "express";

import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { chatRouter } from "./routes/chat.routes";
import { diagnosticsRouter } from "./routes/diagnostics.routes";
import { healthRouter } from "./routes/health.routes";
import { orchestratorRouter } from "./routes/orchestrator.routes";
import { patientsRouter } from "./routes/patients.routes";

/**
 * Monta a aplicação Express. Mantido separado de `server.ts` para permitir
 * testes de integração (ex.: supertest) sem precisar abrir uma porta real.
 */
export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use(healthRouter);
  app.use(chatRouter);
  app.use(diagnosticsRouter);
  app.use(orchestratorRouter);
  app.use(patientsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
