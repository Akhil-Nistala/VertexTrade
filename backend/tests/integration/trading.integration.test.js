// Integration tests against a real MongoDB replica set: what mocks can't
// show — that the conditional updates and transactions actually hold up
// under concurrency, and that a failure mid-order rolls everything back.
//
// Run with: npm run test:integration
// Uses TEST_MONGO_URL (default mongodb://127.0.0.1:27017/vertextrade_test).
// The database is wiped between tests, so its name must end in "_test".

import { jest } from "@jest/globals";
import mongoose from "mongoose";

import { connectDB } from "../../src/config/db.js";
import { Holding } from "../../src/models/holding.model.js";
import { Order } from "../../src/models/order.model.js";
import { Stock } from "../../src/models/stock.model.js";
import { User } from "../../src/models/user.model.js";
import { expirePendingOrders, matchOrders } from "../../src/services/matching.service.js";
import { cancelOrder, placeOrder, settleOrder } from "../../src/services/trading.service.js";

const TEST_MONGO_URL = process.env.TEST_MONGO_URL || "mongodb://127.0.0.1:27017/vertextrade_test";

jest.setTimeout(30000);

let userId;

const buy = (qty, extra = {}) => placeOrder(userId, { name: "ITC", qty, mode: "BUY", type: "MARKET", ...extra });
const sell = (qty, extra = {}) => placeOrder(userId, { name: "ITC", qty, mode: "SELL", type: "MARKET", ...extra });
const limit = (mode, qty, limitPrice) => placeOrder(userId, { name: "ITC", qty, mode, type: "LIMIT", limitPrice });

const balances = async () => {
  const user = await User.findById(userId).lean();
  const holding = await Holding.findOne({ user: userId, name: "ITC" }).lean();
  return {
    cash: user.cash,
    reservedCash: user.reservedCash,
    qty: holding?.qty ?? 0,
    reservedQty: holding?.reservedQty ?? 0,
  };
};

const settled = (results) => results.filter((r) => r.status === "fulfilled");

beforeAll(async () => {
  const dbName = new URL(TEST_MONGO_URL).pathname.slice(1);
  if (!dbName.endsWith("_test")) {
    throw new Error(`Refusing to run: "${dbName}" doesn't end in _test, and these tests wipe it.`);
  }
  await connectDB(TEST_MONGO_URL);
  // Create collections and indexes up front, outside any transaction.
  await Promise.all([User, Stock, Holding, Order].map((model) => model.createCollection().then(() => model.syncIndexes())));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Promise.all([User, Stock, Holding, Order].map((model) => model.deleteMany({})));
  await Stock.create({ symbol: "ITC", price: 200, open: 210 });
  const user = await User.create({ name: "Test", email: "test@example.com", passwordHash: "x", cash: 1000 });
  userId = user._id;
});

describe("market orders", () => {
  it("a buy moves cash into shares", async () => {
    const order = await buy(3);

    expect(order.status).toBe("FILLED");
    expect(await balances()).toEqual({ cash: 400, reservedCash: 0, qty: 3, reservedQty: 0 });
  });

  it("concurrent buys can't spend the same cash twice", async () => {
    // ₹1000 covers one 4-share buy (₹800), not two.
    const results = await Promise.allSettled([buy(4), buy(4)]);

    expect(settled(results)).toHaveLength(1);
    expect(await balances()).toEqual({ cash: 200, reservedCash: 0, qty: 4, reservedQty: 0 });
    expect(await Order.countDocuments()).toBe(1);
  });

  it("concurrent sells can't sell the same shares twice", async () => {
    await buy(3);

    const results = await Promise.allSettled([sell(2), sell(2)]);

    expect(settled(results)).toHaveLength(1);
    expect(await balances()).toMatchObject({ cash: 800, qty: 1 });
  });

  it("rolls back every write if the order fails to save", async () => {
    const spy = jest.spyOn(Order, "create").mockRejectedValueOnce(new Error("disk full"));

    await expect(buy(3)).rejects.toThrow("disk full");

    // The debit and the new holding happened inside the transaction, so both are undone.
    expect(await balances()).toEqual({ cash: 1000, reservedCash: 0, qty: 0, reservedQty: 0 });
    spy.mockRestore();
  });
});

describe("limit orders", () => {
  it("a buy reserves cash, then fills below the limit and refunds the difference", async () => {
    const order = await limit("BUY", 3, 190);
    expect(order.status).toBe("PENDING");
    expect(await balances()).toEqual({ cash: 430, reservedCash: 570, qty: 0, reservedQty: 0 });

    await settleOrder(order._id, { symbol: "ITC", price: 185, open: 210 });

    expect(await balances()).toEqual({ cash: 445, reservedCash: 0, qty: 3, reservedQty: 0 });
    const holding = await Holding.findOne({ user: userId }).lean();
    expect(holding.avg).toBe(185);
    expect(await Order.findById(order._id).lean()).toMatchObject({ status: "FILLED", price: 185 });
  });

  it("reserved cash can't be spent by a market order", async () => {
    await limit("BUY", 4, 190); // reserves ₹760, leaving ₹240

    await expect(buy(2)).rejects.toThrow("Insufficient funds"); // ₹400 > ₹240
    expect(await balances()).toMatchObject({ cash: 240, reservedCash: 760 });
  });

  it("a sell reserves shares that a market sell can't touch, and cancelling releases them", async () => {
    await buy(3);
    const order = await limit("SELL", 2, 250);
    expect(await balances()).toMatchObject({ qty: 3, reservedQty: 2 });

    await expect(sell(2)).rejects.toThrow("you have 1 available");

    await cancelOrder(userId, order._id);
    expect(await balances()).toMatchObject({ qty: 3, reservedQty: 0 });
  });

  it("settling the same order twice at once fills it once", async () => {
    const order = await limit("BUY", 3, 190);
    const quote = { symbol: "ITC", price: 185, open: 210 };

    const results = await Promise.all([settleOrder(order._id, quote), settleOrder(order._id, quote)]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await balances()).toEqual({ cash: 445, reservedCash: 0, qty: 3, reservedQty: 0 });
  });

  it("a cancel racing a fill: exactly one wins and the money adds up", async () => {
    const order = await limit("BUY", 3, 190);

    const [fill, cancel] = await Promise.allSettled([
      settleOrder(order._id, { symbol: "ITC", price: 185, open: 210 }),
      cancelOrder(userId, order._id),
    ]);

    const final = await Order.findById(order._id).lean();
    const after = await balances();
    if (final.status === "FILLED") {
      expect(fill.value).not.toBeNull();
      expect(cancel.status).toBe("rejected");
      expect(after).toEqual({ cash: 445, reservedCash: 0, qty: 3, reservedQty: 0 });
    } else {
      expect(final.status).toBe("CANCELLED");
      expect(fill.value).toBeNull();
      expect(after).toEqual({ cash: 1000, reservedCash: 0, qty: 0, reservedQty: 0 });
    }
  });

  it("the matcher fills orders the new price reaches and leaves the rest", async () => {
    const hit = await limit("BUY", 1, 190);
    const miss = await limit("BUY", 1, 180);

    const filled = await matchOrders(new Map([["ITC", { price: 189, open: 210 }]]));

    expect(filled).toBe(1);
    expect((await Order.findById(hit._id).lean()).status).toBe("FILLED");
    expect((await Order.findById(miss._id).lean()).status).toBe("PENDING");
  });

  it("expiring pending orders releases every reserve", async () => {
    await buy(3);
    await limit("BUY", 2, 150);
    await limit("SELL", 1, 300);

    expect(await expirePendingOrders()).toBe(2);
    expect(await balances()).toEqual({ cash: 400, reservedCash: 0, qty: 3, reservedQty: 0 });
    expect(await Order.countDocuments({ status: "EXPIRED" })).toBe(2);
  });
});
