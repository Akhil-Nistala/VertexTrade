import { Router } from "express";

import { getHoldings } from "../controllers/holding.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", getHoldings);

export default router;
