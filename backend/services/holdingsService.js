const { HoldingsModel } = require("../model/HoldingsModel");
const { formatPercent } = require("../priceSimulator");

// A BUY either opens a new holding or averages into an existing one —
// same cost-basis math a real brokerage uses: new avg is the quantity-
// weighted mean of the old position and the new fill.
async function applyBuy(name, qty, price) {
  const existing = await HoldingsModel.findOne({ name });

  if (!existing) {
    await HoldingsModel.create({
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
}

// A SELL reduces the held quantity (cost basis / avg is unchanged by a
// sell) and is rejected if it would sell more than is actually held —
// closing the position entirely removes the holding.
async function applySell(name, qty) {
  const existing = await HoldingsModel.findOne({ name });

  if (!existing || existing.qty < qty) {
    const held = existing?.qty ?? 0;
    throw new Error(`Cannot sell ${qty} ${name} — you only hold ${held}.`);
  }

  const remainingQty = existing.qty - qty;

  if (remainingQty === 0) {
    await HoldingsModel.deleteOne({ _id: existing._id });
    return;
  }

  existing.qty = remainingQty;
  await existing.save();
}

module.exports = { applyBuy, applySell };
