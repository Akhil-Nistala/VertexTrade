import { Router } from "express";

import { getHoldings, getPositions } from "../controllers/portfolio.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/allHoldings", requireAuth, getHoldings);
router.get("/allPositions", requireAuth, getPositions);

export default router;
