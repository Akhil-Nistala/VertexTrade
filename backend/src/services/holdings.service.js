import { Holding } from "../models/holding.model.js";
import { ApiError } from "../utils/ApiError.js";
import { formatPercent } from "../utils/formatPercent.js";

// A BUY either opens a new holding or averages into an existing one —
// same cost-basis math a real brokerage uses: new avg is the quantity-
// weighted mean of the old position and the new fill.
export const applyBuy = async (userId, name, qty, price) => {
  const existing = await Holding.findOne({ user: userId, name });

  if (!existing) {
    await Holding.create({
      user: userId,
      name,
      qty,
      avg: price,
      price,
      net: "0.00%",
      day: "0.00%",
    });
    return;
  }

  const newQty = existing.qty + qty;
  const newAvg = (existing.avg * existing.qty + price * qty) / newQty;

  existing.qty = newQty;
  existing.avg = newAvg;
  existing.net = formatPercent(((existing.price - newAvg) / newAvg) * 100);
  await existing.save();
};

// A SELL reduces the held quantity (cost basis / avg is unchanged by a
// sell) and is rejected if it would sell more than is actually held —
// closing the position entirely removes the holding.
export const applySell = async (userId, name, qty) => {
  const existing = await Holding.findOne({ user: userId, name });

  if (!existing || existing.qty < qty) {
    const held = existing?.qty ?? 0;
    throw new ApiError(400, `Cannot sell ${qty} ${name} — you only hold ${held}.`);
  }

  const remainingQty = existing.qty - qty;

  if (remainingQty === 0) {
    await Holding.deleteOne({ _id: existing._id });
    return;
  }

  existing.qty = remainingQty;
  await existing.save();
};
