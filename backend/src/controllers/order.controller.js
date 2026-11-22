import { Order } from "../models/order.model.js";
import { applyBuy, applySell } from "../services/holdings.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.userId }).sort({ _id: -1 });
  res.status(200).json(orders);
});

// Body is already validated and trimmed by the order validator. The holding
// is updated first, so a rejected SELL never gets logged as an order.
const placeOrder = asyncHandler(async (req, res) => {
  const { name, qty, price, mode } = req.body;

  if (mode === "BUY") {
    await applyBuy(req.userId, name, qty, price);
  } else {
    await applySell(req.userId, name, qty);
  }

  await Order.create({ user: req.userId, name, qty, price, mode });

  res.status(200).json({ message: "Order saved!" });
});

export { getOrders, placeOrder };
