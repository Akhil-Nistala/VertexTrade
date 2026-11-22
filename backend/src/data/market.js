// The tradable universe and its starting prices. On startup the server makes
// sure every symbol exists in the Stock collection and "opens the market" by
// setting each stock's open price to its current price. It also fills in
// fields added after older documents were written.

import { Holding } from "../models/holding.model.js";
import { Order } from "../models/order.model.js";
import { Stock } from "../models/stock.model.js";
import { STARTING_CASH, User } from "../models/user.model.js";

export const STOCKS = [
  { symbol: "BHARTIARTL", price: 541.15 },
  { symbol: "EVEREADY", price: 312.35 },
  { symbol: "HDFCBANK", price: 1522.35 },
  { symbol: "HINDUNILVR", price: 2417.4 },
  { symbol: "HUL", price: 512.4 },
  { symbol: "INFY", price: 1555.45 },
  { symbol: "ITC", price: 207.9 },
  { symbol: "JUBLFOOD", price: 3082.65 },
  { symbol: "KPITTECH", price: 266.45 },
  { symbol: "M&M", price: 779.8 },
  { symbol: "ONGC", price: 116.8 },
  { symbol: "QUICKHEAL", price: 308.55 },
  { symbol: "RELIANCE", price: 2112.4 },
  { symbol: "SBIN", price: 430.2 },
  { symbol: "SGBMAY29", price: 4719.0 },
  { symbol: "TATAPOWER", price: 124.15 },
  { symbol: "TCS", price: 3194.8 },
  { symbol: "WIPRO", price: 577.75 },
];

export const openMarket = async () => {
  // Insert any missing symbols without touching existing prices.
  await Stock.bulkWrite(
    STOCKS.map(({ symbol, price }) => ({
      updateOne: {
        filter: { symbol },
        update: { $setOnInsert: { symbol, price, open: price } },
        upsert: true,
      },
    }))
  );

  // A new trading day starts when the server does.
  await Stock.updateMany({}, [{ $set: { open: "$price" } }]);

  // Documents written before balances and limit orders existed.
  await User.updateMany({ cash: { $exists: false } }, { $set: { cash: STARTING_CASH } });
  await User.updateMany({ reservedCash: { $exists: false } }, { $set: { reservedCash: 0 } });
  await Holding.updateMany({ reservedQty: { $exists: false } }, { $set: { reservedQty: 0 } });
  await Order.updateMany({ status: { $exists: false } }, [
    { $set: { type: "MARKET", status: "FILLED", closedAt: "$createdAt" } },
  ]);
};
