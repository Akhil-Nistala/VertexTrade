// Order placement, filling, and cancellation.
//
// Every public operation runs in one MongoDB transaction, so the order, the
// user's cash, and their holding change together or not at all. Inside the
// transaction, each step that depends on a balance is a single conditional
// update ("debit only if cash >= amount"), so concurrent requests can't
// overspend or oversell, and each step that closes an order is conditional on
// it still being PENDING, so an order is filled or cancelled exactly once.
//
// Where the money is:
//   user.cash           spendable rupees
//   user.reservedCash   rupees set aside for pending limit buys
//   holding.qty         shares owned (including reserved ones)
//   holding.reservedQty shares set aside for pending limit sells

import { Holding } from "../models/holding.model.js";
import { Order } from "../models/order.model.js";
import { Stock } from "../models/stock.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { formatPercent } from "../utils/formatPercent.js";
import { percentChange, roundMoney } from "../utils/money.js";
import { withTransaction } from "../utils/transaction.js";

const formatRupees = (value) => `₹${value.toFixed(2)}`;

// A limit order can fill once the market is at or better than its limit:
// at or below the limit for a buy, at or above it for a sell.
export const canFillAt = (mode, limitPrice, price) =>
  mode === "BUY" ? price <= limitPrice : price >= limitPrice;

// ── Cash ────────────────────────────────────────────────────────────────────

const throwInsufficientFunds = async (userId, amount, session) => {
  const user = await User.findById(userId, { cash: 1 }, { session });
  throw new ApiError(
    400,
    `Insufficient funds: this order needs ${formatRupees(amount)} but you have ${formatRupees(user?.cash ?? 0)} available.`
  );
};

const debitCash = async (userId, amount, session) => {
  const user = await User.findOneAndUpdate(
    { _id: userId, cash: { $gte: amount } },
    { $inc: { cash: -amount } },
    { session }
  );
  if (!user) await throwInsufficientFunds(userId, amount, session);
};

const creditCash = (userId, amount, session) =>
  User.updateOne({ _id: userId }, { $inc: { cash: amount } }, { session });

const reserveCash = async (userId, amount, session) => {
  const user = await User.findOneAndUpdate(
    { _id: userId, cash: { $gte: amount } },
    { $inc: { cash: -amount, reservedCash: amount } },
    { session }
  );
  if (!user) await throwInsufficientFunds(userId, amount, session);
};

const releaseCash = (userId, amount, session) =>
  User.updateOne({ _id: userId }, { $inc: { cash: amount, reservedCash: -amount } }, { session });

// Settling a limit buy: pay from the reserve. If it filled below the limit,
// the unused part of the reserve goes back to cash.
const spendReservedCash = (userId, reserved, cost, session) =>
  User.updateOne(
    { _id: userId },
    { $inc: { reservedCash: -reserved, cash: roundMoney(reserved - cost) } },
    { session }
  );

// ── Shares ──────────────────────────────────────────────────────────────────

// Matches a holding with at least `qty` shares not reserved for pending sells.
const withAvailableShares = (qty) => ({
  $expr: { $gte: [{ $subtract: ["$qty", { $ifNull: ["$reservedQty", 0] }] }, qty] },
});

const throwNotEnoughShares = async (userId, symbol, qty, session) => {
  const holding = await Holding.findOne({ user: userId, name: symbol }, null, { session });
  const reserved = holding?.reservedQty ?? 0;
  const available = holding ? holding.qty - reserved : 0;
  const note = reserved > 0 ? ` (${reserved} more reserved for open sell orders)` : "";
  throw new ApiError(400, `Cannot sell ${qty} ${symbol} — you have ${available} available${note}.`);
};

// reservedQty never exceeds qty, so a holding with no shares has nothing reserved.
const deleteIfEmpty = async (holding, session) => {
  if (holding.qty === 0) await Holding.deleteOne({ _id: holding._id }, { session });
};

// A new holding starts at the fill price; an existing one averages in — the
// new avg is the quantity-weighted mean of the old position and the new fill.
const addShares = async (userId, stock, qty, price, session) => {
  const existing = await Holding.findOne({ user: userId, name: stock.symbol }, null, { session });

  if (!existing) {
    const dayPercent = percentChange(stock.open, stock.price);
    await Holding.create(
      [
        {
          user: userId,
          name: stock.symbol,
          qty,
          reservedQty: 0,
          avg: price,
          price: stock.price,
          net: formatPercent(percentChange(price, stock.price)),
          day: formatPercent(dayPercent),
          isLoss: dayPercent < 0,
        },
      ],
      { session }
    );
    return;
  }

  const newQty = existing.qty + qty;
  const newAvg = (existing.avg * existing.qty + price * qty) / newQty;

  existing.qty = newQty;
  existing.avg = newAvg;
  existing.net = formatPercent(percentChange(newAvg, existing.price));
  await existing.save({ session });
};

const removeShares = async (userId, symbol, qty, session) => {
  const holding = await Holding.findOneAndUpdate(
    { user: userId, name: symbol, ...withAvailableShares(qty) },
    { $inc: { qty: -qty } },
    { new: true, session }
  );
  if (!holding) await throwNotEnoughShares(userId, symbol, qty, session);
  await deleteIfEmpty(holding, session);
};

const reserveShares = async (userId, symbol, qty, session) => {
  const holding = await Holding.findOneAndUpdate(
    { user: userId, name: symbol, ...withAvailableShares(qty) },
    { $inc: { reservedQty: qty } },
    { session }
  );
  if (!holding) await throwNotEnoughShares(userId, symbol, qty, session);
};

const releaseShares = (userId, symbol, qty, session) =>
  Holding.updateOne({ user: userId, name: symbol }, { $inc: { reservedQty: -qty } }, { session });

// Settling a limit sell: the reserved shares leave the holding.
const deliverReservedShares = async (userId, symbol, qty, session) => {
  const holding = await Holding.findOneAndUpdate(
    { user: userId, name: symbol },
    { $inc: { qty: -qty, reservedQty: -qty } },
    { new: true, session }
  );
  await deleteIfEmpty(holding, session);
};

// ── Orders ──────────────────────────────────────────────────────────────────

const createOrder = async (fields, session) => {
  const [order] = await Order.create([fields], { session });
  return order;
};

// Moves cash and shares for an order that fills right now at `price`.
const fillNow = async (userId, stock, mode, qty, price, session) => {
  const amount = roundMoney(price * qty);
  if (mode === "BUY") {
    await debitCash(userId, amount, session);
    await addShares(userId, stock, qty, price, session);
  } else {
    await removeShares(userId, stock.symbol, qty, session);
    await creditCash(userId, amount, session);
  }
};

// Places a market or limit order. Market orders — and limit orders the market
// already satisfies — fill immediately at the current price. Other limit
// orders reserve what they need and wait as PENDING for the matcher.
export const placeOrder = (userId, { name, qty, mode, type, limitPrice }) =>
  withTransaction(async (session) => {
    const stock = await Stock.findOne({ symbol: name }, null, { session });
    if (!stock) {
      throw new ApiError(400, `Unknown instrument: ${name}.`);
    }

    const order = { user: userId, name: stock.symbol, qty, mode, type, limitPrice };

    if (type === "MARKET" || canFillAt(mode, limitPrice, stock.price)) {
      await fillNow(userId, stock, mode, qty, stock.price, session);
      return createOrder(
        { ...order, status: "FILLED", price: stock.price, closedAt: new Date() },
        session
      );
    }

    // Reserve at the limit price — the most a buy can cost.
    const reserved = mode === "BUY" ? roundMoney(qty * limitPrice) : qty;
    if (mode === "BUY") {
      await reserveCash(userId, reserved, session);
    } else {
      await reserveShares(userId, stock.symbol, qty, session);
    }
    return createOrder({ ...order, status: "PENDING", reserved }, session);
  });

// Fills a PENDING limit order at `quote.price` ({ symbol, price, open }), if
// that price satisfies its limit. Returns the filled order, or null if the
// order is no longer pending or the price doesn't qualify. The claim is a
// single conditional update, so calling this twice — or racing a cancel —
// fills the order at most once.
export const settleOrder = (orderId, quote) =>
  withTransaction(async (session) => {
    const order = await Order.findOneAndUpdate(
      {
        _id: orderId,
        status: "PENDING",
        $or: [
          { mode: "BUY", limitPrice: { $gte: quote.price } },
          { mode: "SELL", limitPrice: { $lte: quote.price } },
        ],
      },
      { $set: { status: "FILLED", price: quote.price, closedAt: new Date() } },
      { new: true, session }
    );
    if (!order) return null;

    const amount = roundMoney(order.qty * quote.price);
    if (order.mode === "BUY") {
      await spendReservedCash(order.user, order.reserved, amount, session);
      await addShares(order.user, quote, order.qty, quote.price, session);
    } else {
      await deliverReservedShares(order.user, order.name, order.qty, session);
      await creditCash(order.user, amount, session);
    }
    return order;
  });

// Moves a PENDING order matching `filter` to `status` and releases its
// reserve. Returns null if no pending order matched.
const closePendingOrder = async (filter, status, session) => {
  const order = await Order.findOneAndUpdate(
    { ...filter, status: "PENDING" },
    { $set: { status, closedAt: new Date() } },
    { new: true, session }
  );
  if (!order) return null;

  if (order.mode === "BUY") {
    await releaseCash(order.user, order.reserved, session);
  } else {
    await releaseShares(order.user, order.name, order.reserved, session);
  }
  return order;
};

export const cancelOrder = (userId, orderId) =>
  withTransaction(async (session) => {
    const order = await closePendingOrder({ _id: orderId, user: userId }, "CANCELLED", session);
    if (order) return order;

    // Scoped to the user, so another user's order looks the same as a missing one.
    const existing = await Order.findOne({ _id: orderId, user: userId }, { status: 1 }, { session });
    if (!existing) {
      throw new ApiError(404, "Order not found.");
    }
    throw new ApiError(409, `This order is already ${existing.status.toLowerCase()}.`);
  });

export const expireOrder = (orderId) =>
  withTransaction((session) => closePendingOrder({ _id: orderId }, "EXPIRED", session));
