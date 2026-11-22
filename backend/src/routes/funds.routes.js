import { Router } from "express";

import { getFunds } from "../controllers/funds.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", getFunds);

export default router;
