import { z } from "zod";

const INVALID_ORDER =
  "Invalid order: name must be a non-empty string, qty a positive integer, price a positive number, and mode either BUY or SELL.";

export const newOrderSchema = z.object(
  {
    name: z.string({ message: INVALID_ORDER }).trim().min(1, INVALID_ORDER),
    qty: z.number({ message: INVALID_ORDER }).int(INVALID_ORDER).positive(INVALID_ORDER),
    price: z.number({ message: INVALID_ORDER }).finite(INVALID_ORDER).positive(INVALID_ORDER),
    mode: z.enum(["BUY", "SELL"], { message: INVALID_ORDER }),
  },
  { message: INVALID_ORDER }
);
