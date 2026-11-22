import { Order } from "../models/order.model.js";
import { placeOrder as fillOrder } from "../services/trading.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.userId }).sort({ _id: -1 });
  res.status(200).json(orders);
});

// Body is validated by the order validator: { name, qty, mode }. Any price
// the client sends is ignored — orders fill at the server's market price.
const placeOrder = asyncHandler(async (req, res) => {
  const { order, cash } = await fillOrder(req.userId, req.body);
  res.status(201).json({ success: true, order, cash });
});

export { getOrders, placeOrder };
