import { Router } from "express";

import { getPositions } from "../controllers/position.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", getPositions);

export default router;
