import { Router } from "express";

import { postRoute } from "../controllers/orchestrator.controller";
import { requireAuth } from "../middleware/auth";

export const orchestratorRouter = Router();

orchestratorRouter.post("/api/orchestrator/route", requireAuth, postRoute);
