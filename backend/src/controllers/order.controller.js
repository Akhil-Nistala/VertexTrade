import { Order } from "../models/order.model.js";
import { getFunds } from "../services/funds.service.js";
import { cancelOrder as cancel, placeOrder as place } from "../services/trading.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Optional ?status=PENDING|FILLED|CANCELLED|EXPIRED filter, newest first.
const getOrders = asyncHandler(async (req, res) => {
  const filter = { user: req.userId };
  if (req.query.status) filter.status = req.query.status;

  const orders = await Order.find(filter).sort({ _id: -1 });
  res.status(200).json(orders);
});

// Body is validated by placeOrderSchema. Responds with the order (FILLED, or
// PENDING for a resting limit order) and the user's balances afterwards.
const placeOrder = asyncHandler(async (req, res) => {
  const order = await place(req.userId, req.body);
  res.status(201).json({ success: true, order, funds: await getFunds(req.userId) });
});

const cancelOrder = asyncHandler(async (req, res) => {
  const order = await cancel(req.userId, req.params.id);
  res.status(200).json({ success: true, order, funds: await getFunds(req.userId) });
});

export { cancelOrder, getOrders, placeOrder };
