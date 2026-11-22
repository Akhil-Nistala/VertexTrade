// Trading logic with mocked models: market fills, limit orders (reserve,
// immediate fill, settle, cancel, expire), and matching. Each test checks the
// exact conditional updates, since those are what make concurrent requests
// safe — and that every write carries the transaction's session.

import { jest } from "@jest/globals";

import { SESSION, mockModels, query, resetModels } from "./support/mockModels.js";

const models = mockModels();
const { Holding, Order, Stock, User } = models;

const request = (await import("supertest")).default;
const { default: app } = await import("../src/app.js");
const { signSessionToken } = await import("../src/utils/tokens.js");
const { settleOrder } = await import("../src/services/trading.service.js");
const { expirePendingOrders, matchOrders } = await import("../src/services/matching.service.js");

const USER_ID = "64b000000000000000000001";
const ORDER_ID = "64b0000000000000000000aa";
const authCookie = `token=${signSessionToken({ _id: USER_ID })}`;

const ITC = { symbol: "ITC", price: 200, open: 210 };
const withSession = { session: SESSION };
const AVAILABLE_SHARES = (qty) => ({
  $expr: { $gte: [{ $subtract: ["$qty", { $ifNull: ["$reservedQty", 0] }] }, qty] },
});

const placeOrder = (body) => request(app).post("/api/v1/orders").set("Cookie", authCookie).send(body);
const cancelOrder = (id = ORDER_ID) =>
  request(app).post(`/api/v1/orders/${id}/cancel`).set("Cookie", authCookie);

beforeEach(() => {
  resetModels(models);
  Stock.findOne.mockResolvedValue(ITC);
});

describe("market orders", () => {
  it("BUY fills at the market price, ignoring any client-sent price", async () => {
    User.findOneAndUpdate.mockResolvedValue({ cash: 99400 });
    Holding.findOne.mockResolvedValue(null);

    const res = await placeOrder({ name: "ITC", qty: 3, price: 1, mode: "BUY" });

    expect(res.status).toBe(201);
    expect(res.body.order).toMatchObject({ type: "MARKET", status: "FILLED", price: 200 });
    expect(res.body.funds).toEqual({ cash: 100000, reservedCash: 0 });
    expect(Order.create).toHaveBeenCalledWith(
      [expect.objectContaining({ user: USER_ID, name: "ITC", qty: 3, mode: "BUY", price: 200 })],
      withSession
    );
    expect(Holding.create).toHaveBeenCalledWith(
      [expect.objectContaining({ user: USER_ID, name: "ITC", qty: 3, avg: 200, reservedQty: 0 })],
      withSession
    );
  });

  it("BUY debits cash with one conditional update inside the transaction", async () => {
    User.findOneAndUpdate.mockResolvedValue({ cash: 99400 });
    Holding.findOne.mockResolvedValue(null);

    await placeOrder({ name: "ITC", qty: 3, mode: "BUY" });

    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: USER_ID, cash: { $gte: 600 } },
      { $inc: { cash: -600 } },
      withSession
    );
  });

  it("BUY is rejected when funds are insufficient, without creating a holding or order", async () => {
    User.findOneAndUpdate.mockResolvedValue(null);
    User.findById.mockResolvedValue({ cash: 100 });

    const res = await placeOrder({ name: "ITC", qty: 3, mode: "BUY" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Insufficient funds: this order needs ₹600.00 but you have ₹100.00 available.");
    expect(Holding.create).not.toHaveBeenCalled();
    expect(Order.create).not.toHaveBeenCalled();
  });

  it("BUY averages into an existing holding at the fill price", async () => {
    User.findOneAndUpdate.mockResolvedValue({ cash: 99600 });
    const existing = { qty: 2, avg: 100, price: 200, save: jest.fn() };
    Holding.findOne.mockResolvedValue(existing);

    await placeOrder({ name: "ITC", qty: 2, mode: "BUY" });

    expect(existing.qty).toBe(4);
    expect(existing.avg).toBe(150);
    expect(existing.save).toHaveBeenCalledWith(withSession);
  });

  it("SELL removes only unreserved shares and credits the proceeds", async () => {
    Holding.findOneAndUpdate.mockResolvedValue({ _id: "h1", qty: 3 });

    const res = await placeOrder({ name: "ITC", qty: 2, mode: "SELL" });

    expect(res.status).toBe(201);
    expect(Holding.findOneAndUpdate).toHaveBeenCalledWith(
      { user: USER_ID, name: "ITC", ...AVAILABLE_SHARES(2) },
      { $inc: { qty: -2 } },
      { new: true, session: SESSION }
    );
    expect(User.updateOne).toHaveBeenCalledWith({ _id: USER_ID }, { $inc: { cash: 400 } }, withSession);
    expect(Holding.deleteOne).not.toHaveBeenCalled();
  });

  it("SELL of the whole holding deletes it", async () => {
    Holding.findOneAndUpdate.mockResolvedValue({ _id: "h1", qty: 0 });

    await placeOrder({ name: "ITC", qty: 2, mode: "SELL" });

    expect(Holding.deleteOne).toHaveBeenCalledWith({ _id: "h1" }, withSession);
  });

  it("SELL beyond the available shares is rejected and explains reserved shares", async () => {
    Holding.findOneAndUpdate.mockResolvedValue(null);
    Holding.findOne.mockResolvedValue({ qty: 5, reservedQty: 4 });

    const res = await placeOrder({ name: "ITC", qty: 2, mode: "SELL" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Cannot sell 2 ITC — you have 1 available (4 more reserved for open sell orders).");
    expect(User.updateOne).not.toHaveBeenCalled();
    expect(Order.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown symbol", async () => {
    Stock.findOne.mockResolvedValue(null);

    const res = await placeOrder({ name: "NOPE", qty: 1, mode: "BUY" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Unknown instrument: NOPE.");
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("limit orders: placing", () => {
  it("a BUY below the market reserves qty × limit and waits as PENDING", async () => {
    User.findOneAndUpdate.mockResolvedValue({ cash: 99430 });

    const res = await placeOrder({ name: "ITC", qty: 3, mode: "BUY", type: "LIMIT", limitPrice: 190 });

    expect(res.status).toBe(201);
    expect(res.body.order).toMatchObject({ type: "LIMIT", status: "PENDING", limitPrice: 190, reserved: 570 });
    expect(res.body.order.price).toBeUndefined();
    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: USER_ID, cash: { $gte: 570 } },
      { $inc: { cash: -570, reservedCash: 570 } },
      withSession
    );
    expect(Holding.findOne).not.toHaveBeenCalled();
    expect(Holding.create).not.toHaveBeenCalled();
  });

  it("a BUY whose reserve exceeds the cash is rejected", async () => {
    User.findOneAndUpdate.mockResolvedValue(null);
    User.findById.mockResolvedValue({ cash: 100 });

    const res = await placeOrder({ name: "ITC", qty: 3, mode: "BUY", type: "LIMIT", limitPrice: 190 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Insufficient funds: this order needs ₹570.00/);
    expect(Order.create).not.toHaveBeenCalled();
  });

  it("a BUY at or above the market fills immediately at the market price, not the limit", async () => {
    User.findOneAndUpdate.mockResolvedValue({ cash: 99400 });
    Holding.findOne.mockResolvedValue(null);

    const res = await placeOrder({ name: "ITC", qty: 3, mode: "BUY", type: "LIMIT", limitPrice: 250 });

    expect(res.body.order).toMatchObject({ type: "LIMIT", status: "FILLED", price: 200, limitPrice: 250 });
    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: USER_ID, cash: { $gte: 600 } },
      { $inc: { cash: -600 } },
      withSession
    );
  });

  it("a SELL above the market reserves the shares and waits as PENDING", async () => {
    Holding.findOneAndUpdate.mockResolvedValue({ _id: "h1", qty: 5, reservedQty: 2 });

    const res = await placeOrder({ name: "ITC", qty: 2, mode: "SELL", type: "LIMIT", limitPrice: 220 });

    expect(res.body.order).toMatchObject({ type: "LIMIT", status: "PENDING", reserved: 2 });
    expect(Holding.findOneAndUpdate).toHaveBeenCalledWith(
      { user: USER_ID, name: "ITC", ...AVAILABLE_SHARES(2) },
      { $inc: { reservedQty: 2 } },
      withSession
    );
    expect(User.updateOne).not.toHaveBeenCalled();
  });

  it("a SELL at or below the market fills immediately at the market price", async () => {
    Holding.findOneAndUpdate.mockResolvedValue({ _id: "h1", qty: 3 });

    const res = await placeOrder({ name: "ITC", qty: 2, mode: "SELL", type: "LIMIT", limitPrice: 150 });

    expect(res.body.order).toMatchObject({ status: "FILLED", price: 200 });
    expect(User.updateOne).toHaveBeenCalledWith({ _id: USER_ID }, { $inc: { cash: 400 } }, withSession);
  });
});

describe("limit orders: settling", () => {
  const quote = { symbol: "ITC", price: 185, open: 210 };
  const claimFilter = {
    _id: ORDER_ID,
    status: "PENDING",
    $or: [
      { mode: "BUY", limitPrice: { $gte: 185 } },
      { mode: "SELL", limitPrice: { $lte: 185 } },
    ],
  };

  it("claims the order only if it's still PENDING and the price satisfies the limit", async () => {
    Order.findOneAndUpdate.mockResolvedValue(null);

    const result = await settleOrder(ORDER_ID, quote);

    expect(result).toBeNull();
    expect(Order.findOneAndUpdate).toHaveBeenCalledWith(
      claimFilter,
      { $set: { status: "FILLED", price: 185, closedAt: expect.any(Date) } },
      { new: true, session: SESSION }
    );
    expect(User.updateOne).not.toHaveBeenCalled();
    expect(Holding.create).not.toHaveBeenCalled();
  });

  it("a BUY pays from the reserve and returns the unused part to cash", async () => {
    Order.findOneAndUpdate.mockResolvedValue({ user: USER_ID, name: "ITC", mode: "BUY", qty: 3, reserved: 570 });
    Holding.findOne.mockResolvedValue(null);

    await settleOrder(ORDER_ID, quote);

    // Reserved ₹570 at a limit of 190; filled at 185 → costs ₹555, ₹15 back.
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: USER_ID },
      { $inc: { reservedCash: -570, cash: 15 } },
      withSession
    );
    expect(Holding.create).toHaveBeenCalledWith(
      [expect.objectContaining({ user: USER_ID, name: "ITC", qty: 3, avg: 185 })],
      withSession
    );
  });

  it("a SELL delivers the reserved shares and credits the proceeds", async () => {
    Order.findOneAndUpdate.mockResolvedValue({ user: USER_ID, name: "ITC", mode: "SELL", qty: 2, reserved: 2 });
    Holding.findOneAndUpdate.mockResolvedValue({ _id: "h1", qty: 3, reservedQty: 0 });

    await settleOrder(ORDER_ID, quote);

    expect(Holding.findOneAndUpdate).toHaveBeenCalledWith(
      { user: USER_ID, name: "ITC" },
      { $inc: { qty: -2, reservedQty: -2 } },
      { new: true, session: SESSION }
    );
    expect(User.updateOne).toHaveBeenCalledWith({ _id: USER_ID }, { $inc: { cash: 370 } }, withSession);
    expect(Holding.deleteOne).not.toHaveBeenCalled();
  });

  it("a SELL of the last shares deletes the holding", async () => {
    Order.findOneAndUpdate.mockResolvedValue({ user: USER_ID, name: "ITC", mode: "SELL", qty: 2, reserved: 2 });
    Holding.findOneAndUpdate.mockResolvedValue({ _id: "h1", qty: 0, reservedQty: 0 });

    await settleOrder(ORDER_ID, quote);

    expect(Holding.deleteOne).toHaveBeenCalledWith({ _id: "h1" }, withSession);
  });
});

describe("limit orders: cancelling", () => {
  it("a pending BUY is cancelled and its reserved cash released", async () => {
    Order.findOneAndUpdate.mockResolvedValue({ _id: ORDER_ID, user: USER_ID, mode: "BUY", reserved: 570, status: "CANCELLED" });

    const res = await cancelOrder();

    expect(res.status).toBe(200);
    expect(Order.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: ORDER_ID, user: USER_ID, status: "PENDING" },
      { $set: { status: "CANCELLED", closedAt: expect.any(Date) } },
      { new: true, session: SESSION }
    );
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: USER_ID },
      { $inc: { cash: 570, reservedCash: -570 } },
      withSession
    );
  });

  it("a pending SELL is cancelled and its reserved shares released", async () => {
    Order.findOneAndUpdate.mockResolvedValue({ user: USER_ID, name: "ITC", mode: "SELL", reserved: 2 });

    await cancelOrder();

    expect(Holding.updateOne).toHaveBeenCalledWith(
      { user: USER_ID, name: "ITC" },
      { $inc: { reservedQty: -2 } },
      withSession
    );
  });

  it("returns 404 for an order that isn't this user's", async () => {
    Order.findOneAndUpdate.mockResolvedValue(null);
    Order.findOne.mockResolvedValue(null);

    const res = await cancelOrder();

    expect(res.status).toBe(404);
    expect(Order.findOne).toHaveBeenCalledWith({ _id: ORDER_ID, user: USER_ID }, { status: 1 }, withSession);
  });

  it("returns 409 for an order that's no longer pending, without releasing anything", async () => {
    Order.findOneAndUpdate.mockResolvedValue(null);
    Order.findOne.mockResolvedValue({ status: "FILLED" });

    const res = await cancelOrder();

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("This order is already filled.");
    expect(User.updateOne).not.toHaveBeenCalled();
    expect(Holding.updateOne).not.toHaveBeenCalled();
  });
});

describe("matching and expiry", () => {
  it("settles only the pending orders the new price satisfies, oldest first", async () => {
    Order.find.mockReturnValue(
      query([
        { _id: "buy-hit", name: "ITC", mode: "BUY", limitPrice: 190 },
        { _id: "buy-miss", name: "ITC", mode: "BUY", limitPrice: 180 },
        { _id: "sell-hit", name: "ITC", mode: "SELL", limitPrice: 185 },
        { _id: "sell-miss", name: "ITC", mode: "SELL", limitPrice: 195 },
      ])
    );
    Order.findOneAndUpdate.mockResolvedValue(null);

    await matchOrders(new Map([["ITC", { price: 185, open: 210 }]]));

    expect(Order.find).toHaveBeenCalledWith(
      { status: "PENDING", name: { $in: ["ITC"] } },
      { name: 1, mode: 1, limitPrice: 1 }
    );
    const settled = Order.findOneAndUpdate.mock.calls.map(([filter]) => filter._id);
    expect(settled).toEqual(["buy-hit", "sell-hit"]);
  });

  it("keeps matching after one order fails to settle", async () => {
    Order.find.mockReturnValue(
      query([
        { _id: "a", name: "ITC", mode: "BUY", limitPrice: 190 },
        { _id: "b", name: "ITC", mode: "BUY", limitPrice: 190 },
      ])
    );
    Order.findOneAndUpdate.mockRejectedValueOnce(new Error("write conflict")).mockResolvedValueOnce(null);
    const logSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await matchOrders(new Map([["ITC", { price: 185, open: 210 }]]));

    expect(Order.findOneAndUpdate).toHaveBeenCalledTimes(2);
    logSpy.mockRestore();
  });

  it("expires every pending order and releases its reserve", async () => {
    Order.find.mockReturnValue(query([{ _id: "a" }]));
    Order.findOneAndUpdate.mockResolvedValue({ user: USER_ID, mode: "BUY", reserved: 570 });

    const expired = await expirePendingOrders();

    expect(expired).toBe(1);
    expect(Order.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "a", status: "PENDING" },
      { $set: { status: "EXPIRED", closedAt: expect.any(Date) } },
      { new: true, session: SESSION }
    );
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: USER_ID },
      { $inc: { cash: 570, reservedCash: -570 } },
      withSession
    );
  });
});
