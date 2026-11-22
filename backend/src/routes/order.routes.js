import { Router } from "express";

import { cancelOrder, getOrders, placeOrder } from "../controllers/order.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  listOrdersQuerySchema,
  orderIdParamsSchema,
  placeOrderSchema,
} from "../validators/order.validator.js";

const router = Router();

router.use(requireAuth);

router.get("/", validate(listOrdersQuerySchema, "query"), getOrders);
router.post("/", validate(placeOrderSchema), placeOrder);
router.post("/:id/cancel", validate(orderIdParamsSchema, "params"), cancelOrder);

export default router;
