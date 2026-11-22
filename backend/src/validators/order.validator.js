import { z } from "zod";

import { ORDER_STATUSES } from "../models/order.model.js";

const INVALID_ORDER =
  "Invalid order: name must be a non-empty string, qty a positive integer, and mode either BUY or SELL.";

const hasAtMostTwoDecimals = (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

// { name, qty, mode, type?, limitPrice? }. `type` defaults to MARKET. There
// is no fill-price field: market orders fill at the server's price, and a
// limit order's limitPrice is only the worst price the user accepts. Unknown
// keys (such as a client-sent price) are stripped.
export const placeOrderSchema = z
  .object(
    {
      name: z.string({ message: INVALID_ORDER }).trim().min(1, INVALID_ORDER),
      qty: z.number({ message: INVALID_ORDER }).int(INVALID_ORDER).positive(INVALID_ORDER),
      mode: z.enum(["BUY", "SELL"], { message: INVALID_ORDER }),
      type: z.enum(["MARKET", "LIMIT"], { message: "type must be MARKET or LIMIT." }).default("MARKET"),
      limitPrice: z
        .number({ message: "limitPrice must be a positive number." })
        .finite("limitPrice must be a positive number.")
        .positive("limitPrice must be a positive number.")
        .refine(hasAtMostTwoDecimals, "limitPrice can have at most 2 decimal places.")
        .optional(),
    },
    { message: INVALID_ORDER }
  )
  .superRefine((order, ctx) => {
    if (order.type === "LIMIT" && order.limitPrice === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["limitPrice"], message: "Limit orders need a limitPrice." });
    }
    if (order.type === "MARKET" && order.limitPrice !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["limitPrice"],
        message: "Market orders fill at the market price, so they don't take a limitPrice.",
      });
    }
  });

export const orderIdParamsSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid order id."),
});

export const listOrdersQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES, { message: `status must be one of ${ORDER_STATUSES.join(", ")}.` }).optional(),
});
