import { Holding } from "../models/holding.model.js";
import { Order } from "../models/order.model.js";
import { Stock } from "../models/stock.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { formatPercent } from "../utils/formatPercent.js";
import { percentChange, roundMoney } from "../utils/money.js";

const formatRupees = (value) => `₹${value.toFixed(2)}`;

// Adds a filled BUY to the user's holding. A new holding starts at the fill
// price; an existing one averages in — the new avg is the quantity-weighted
// mean of the old position and the new fill.
const addToHolding = async (userId, stock, qty) => {
  const existing = await Holding.findOne({ user: userId, name: stock.symbol });
  const dayPercent = percentChange(stock.open, stock.price);

  if (!existing) {
    await Holding.create({
      user: userId,
      name: stock.symbol,
      qty,
      avg: stock.price,
      price: stock.price,
      net: formatPercent(0),
      day: formatPercent(dayPercent),
      isLoss: dayPercent < 0,
    });
    return;
  }

  const newQty = existing.qty + qty;
  const newAvg = (existing.avg * existing.qty + stock.price * qty) / newQty;

  existing.qty = newQty;
  existing.avg = newAvg;
  existing.net = formatPercent(percentChange(newAvg, existing.price));
  await existing.save();
};

const buy = async (userId, stock, qty, amount) => {
  // Atomic check-and-debit: the update only matches if the balance covers
  // the cost, so two simultaneous buys can't both spend the same cash.
  const debited = await User.findOneAndUpdate(
    { _id: userId, cash: { $gte: amount } },
    { $inc: { cash: -amount } },
    { new: true }
  );

  if (!debited) {
    const user = await User.findById(userId);
    throw new ApiError(
      400,
      `Insufficient funds: this order costs ${formatRupees(amount)} but you have ${formatRupees(user?.cash ?? 0)}.`
    );
  }

  try {
    await addToHolding(userId, stock, qty);
  } catch (err) {
    // Without a transaction, undo the debit if the holding couldn't be saved.
    await User.updateOne({ _id: userId }, { $inc: { cash: amount } });
    throw err;
  }

  return debited.cash;
};

const sell = async (userId, stock, qty, amount) => {
  // Atomic check-and-decrement: only matches if the user holds enough, so
  // two simultaneous sells can't oversell the same shares.
  const remaining = await Holding.findOneAndUpdate(
    { user: userId, name: stock.symbol, qty: { $gte: qty } },
    { $inc: { qty: -qty } },
    { new: true }
  );

  if (!remaining) {
    const held = (await Holding.findOne({ user: userId, name: stock.symbol }))?.qty ?? 0;
    throw new ApiError(400, `Cannot sell ${qty} ${stock.symbol} — you only hold ${held}.`);
  }

  if (remaining.qty === 0) {
    await Holding.deleteOne({ _id: remaining._id });
  }

  const credited = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { cash: amount } },
    { new: true }
  );
  return credited.cash;
};

// Fills an order at the server's current market price — the client never
// chooses the price. Returns the logged order and the user's new balance.
// A rejected order (unknown symbol, insufficient funds, oversell) throws
// before anything is logged.
export const placeOrder = async (userId, { name, qty, mode }) => {
  const stock = await Stock.findOne({ symbol: name });
  if (!stock) {
    throw new ApiError(400, `Unknown instrument: ${name}.`);
  }

  const amount = roundMoney(stock.price * qty);

  const cash =
    mode === "BUY" ? await buy(userId, stock, qty, amount) : await sell(userId, stock, qty, amount);

  const order = await Order.create({ user: userId, name: stock.symbol, qty, price: stock.price, mode });

  return { order, cash: roundMoney(cash) };
};
