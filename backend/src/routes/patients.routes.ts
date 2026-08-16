import { Router } from "express";

import { getHealthScore } from "../controllers/patients.controller";
import { requireAuth } from "../middleware/auth";

export const patientsRouter = Router();

patientsRouter.get("/api/patients/me/health-score", requireAuth, getHealthScore);
