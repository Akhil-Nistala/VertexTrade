import { z } from "zod";

const INVALID_ORDER =
  "Invalid order: name must be a non-empty string, qty a positive integer, and mode either BUY or SELL.";

// No price: orders fill at the server's market price. Unknown keys (such as
// a client-sent price) are stripped by zod.
export const newOrderSchema = z.object(
  {
    name: z.string({ message: INVALID_ORDER }).trim().min(1, INVALID_ORDER),
    qty: z.number({ message: INVALID_ORDER }).int(INVALID_ORDER).positive(INVALID_ORDER),
    mode: z.enum(["BUY", "SELL"], { message: INVALID_ORDER }),
  },
  { message: INVALID_ORDER }
);
