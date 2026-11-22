// Lightweight "live market": every few seconds, move each stock's price by a
// small bounded random percentage, copy the new prices onto every holding and
// position so all users see the same market, then fill any limit orders the
// new prices satisfy. A failed tick is logged and the next one carries on.

import { Stock } from "../models/stock.model.js";
import { Holding } from "../models/holding.model.js";
import { Position } from "../models/position.model.js";
import { formatPercent } from "../utils/formatPercent.js";
import { percentChange, roundMoney } from "../utils/money.js";
import { matchOrders } from "./matching.service.js";

const TICK_INTERVAL_MS = 4000;
const MIN_MOVE_PERCENT = 0.05;
const MAX_MOVE_PERCENT = 0.4;

const randomMovePercent = () => {
  const magnitude = MIN_MOVE_PERCENT + Math.random() * (MAX_MOVE_PERCENT - MIN_MOVE_PERCENT);
  const direction = Math.random() < 0.5 ? -1 : 1;
  return direction * magnitude;
};

const tickStocks = async () => {
  const stocks = await Stock.find({});
  const quotes = new Map();

  const ops = stocks.map((stock) => {
    const price = roundMoney(Math.max(0.05, stock.price * (1 + randomMovePercent() / 100)));
    quotes.set(stock.symbol, { price, open: stock.open });
    return { updateOne: { filter: { _id: stock._id }, update: { $set: { price } } } };
  });

  if (ops.length > 0) await Stock.bulkWrite(ops);
  return quotes;
};

// Sets price, day change (vs open), and net change (vs the holder's average
// cost) on every document whose symbol has a quote.
const syncToQuotes = async (Model, quotes) => {
  const docs = await Model.find({}, { name: 1, avg: 1 }).lean();

  const ops = docs
    .filter((doc) => quotes.has(doc.name))
    .map((doc) => {
      const { price, open } = quotes.get(doc.name);
      const dayPercent = percentChange(open, price);
      return {
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              price,
              day: formatPercent(dayPercent),
              net: formatPercent(percentChange(doc.avg, price)),
              isLoss: dayPercent < 0,
            },
          },
        },
      };
    });

  if (ops.length > 0) await Model.bulkWrite(ops);
};

const tick = async () => {
  const quotes = await tickStocks();
  await Promise.all([syncToQuotes(Holding, quotes), syncToQuotes(Position, quotes)]);
  await matchOrders(quotes);
};

// Each tick is scheduled only after the previous one finishes, so a slow tick
// (many orders to match) never overlaps the next. Returns a stop function.
export const startPriceSimulator = () => {
  let timer;
  const loop = async () => {
    try {
      await tick();
    } catch (err) {
      console.error("Price tick failed:", err.message);
    }
    timer = setTimeout(loop, TICK_INTERVAL_MS);
  };
  timer = setTimeout(loop, TICK_INTERVAL_MS);
  return () => clearTimeout(timer);
};
