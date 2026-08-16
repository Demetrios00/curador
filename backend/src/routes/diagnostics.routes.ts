import { Router } from "express";

import { getAgentLogsSummary } from "../controllers/agentLogsSummary.controller";
import { getFirebaseCheck } from "../controllers/diagnostics.controller";

export const diagnosticsRouter = Router();

diagnosticsRouter.get("/api/_internal/firebase-check", getFirebaseCheck);
diagnosticsRouter.get("/api/_internal/agent-logs/summary", getAgentLogsSummary);
