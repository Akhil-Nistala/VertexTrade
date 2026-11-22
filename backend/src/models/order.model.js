import mongoose, { Schema } from "mongoose";

export const ORDER_MODES = ["BUY", "SELL"];
export const ORDER_TYPES = ["MARKET", "LIMIT"];

// PENDING → FILLED     the price reached the limit (or it was a market order)
// PENDING → CANCELLED  the user cancelled it
// PENDING → EXPIRED    the trading day ended (the server restarted)
// Market orders, and limit orders that can fill immediately, are created FILLED.
export const ORDER_STATUSES = ["PENDING", "FILLED", "CANCELLED", "EXPIRED"];

const orderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    qty: { type: Number, required: true },
    mode: { type: String, enum: ORDER_MODES, required: true },
    type: { type: String, enum: ORDER_TYPES, default: "MARKET" },
    status: { type: String, enum: ORDER_STATUSES, default: "FILLED" },
    // LIMIT only: the worst price the user accepts (max for a buy, min for a sell).
    limitPrice: Number,
    // Set aside while PENDING: rupees for a buy, shares for a sell.
    reserved: Number,
    // The price it actually filled at. Unset unless FILLED.
    price: Number,
    // When it left PENDING (or was created already filled).
    closedAt: Date,
  },
  { timestamps: true }
);

// The matcher's query on every price tick: pending orders for these symbols.
orderSchema.index({ status: 1, name: 1 });

const Order = mongoose.model("Order", orderSchema);

export { Order };
