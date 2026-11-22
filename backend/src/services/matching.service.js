import { Order } from "../models/order.model.js";
import { canFillAt, expireOrder, settleOrder } from "./trading.service.js";

// Runs after every price tick with the new quotes (symbol → { price, open }).
// Fills each pending limit order whose limit the new price satisfies, oldest
// first. Orders settle one at a time, so a user's orders don't contend for
// the same cash document; a failure on one order doesn't stop the rest.
export const matchOrders = async (quotes) => {
  const pending = await Order.find(
    { status: "PENDING", name: { $in: [...quotes.keys()] } },
    { name: 1, mode: 1, limitPrice: 1 }
  )
    .sort({ createdAt: 1 })
    .lean();

  let filled = 0;
  for (const order of pending) {
    const quote = quotes.get(order.name);
    if (!canFillAt(order.mode, order.limitPrice, quote.price)) continue;

    try {
      if (await settleOrder(order._id, { symbol: order.name, ...quote })) filled += 1;
    } catch (err) {
      console.error(`Could not settle order ${order._id}:`, err.message);
    }
  }
  return filled;
};

// Limit orders are day orders: anything still pending when the market opens
// again (when the server starts) expires, and its reserve is released.
export const expirePendingOrders = async () => {
  const pending = await Order.find({ status: "PENDING" }, { _id: 1 }).lean();
  for (const { _id } of pending) {
    await expireOrder(_id);
  }
  return pending.length;
};
