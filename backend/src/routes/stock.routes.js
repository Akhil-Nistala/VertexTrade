import { Router } from "express";

import { getStocks } from "../controllers/stock.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", getStocks);

export default router;
