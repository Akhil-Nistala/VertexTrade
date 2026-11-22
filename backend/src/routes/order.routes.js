import { Router } from "express";

import { getOrders, placeOrder } from "../controllers/order.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { newOrderSchema } from "../validators/order.validator.js";

const router = Router();

router.get("/allOrders", requireAuth, getOrders);
router.post("/newOrder", requireAuth, validate(newOrderSchema), placeOrder);

export default router;
