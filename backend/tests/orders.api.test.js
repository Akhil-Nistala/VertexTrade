// HTTP contract: routing, the auth guard, validation, and per-user scoping.
// Trading behaviour lives in trading.test.js.

import { mockModels, query, resetModels } from "./support/mockModels.js";

const models = mockModels();
const { Holding, Order, Position, Stock, User } = models;

const request = (await import("supertest")).default;
const { default: app } = await import("../src/app.js");
const { signSessionToken } = await import("../src/utils/tokens.js");

const USER_ID = "64b000000000000000000001";
const ORDER_ID = "64b0000000000000000000aa";
const authCookie = `token=${signSessionToken({ _id: USER_ID })}`;

const get = (path) => request(app).get(path).set("Cookie", authCookie);
const post = (path, body) => request(app).post(path).set("Cookie", authCookie).send(body);

beforeEach(() => resetModels(models));

describe("auth guard", () => {
  it.each([
    ["get", "/api/v1/holdings"],
    ["get", "/api/v1/positions"],
    ["get", "/api/v1/orders"],
    ["post", "/api/v1/orders"],
    ["post", `/api/v1/orders/${ORDER_ID}/cancel`],
    ["get", "/api/v1/stocks"],
    ["get", "/api/v1/funds"],
  ])("%s %s returns 401 without a session", async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });
});

describe("data is scoped to the logged-in user", () => {
  it("GET /holdings queries only this user's holdings", async () => {
    Holding.find.mockResolvedValue([{ name: "INFY" }]);

    const res = await get("/api/v1/holdings");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ name: "INFY" }]);
    expect(Holding.find).toHaveBeenCalledWith({ user: USER_ID });
  });

  it("GET /positions queries only this user's positions", async () => {
    Position.find.mockResolvedValue([]);
    await get("/api/v1/positions");
    expect(Position.find).toHaveBeenCalledWith({ user: USER_ID });
  });

  it("GET /orders queries only this user's orders, newest first", async () => {
    Order.find.mockReturnValue(query([]));
    await get("/api/v1/orders");
    expect(Order.find).toHaveBeenCalledWith({ user: USER_ID });
  });

  it("GET /orders?status=PENDING filters by status", async () => {
    Order.find.mockReturnValue(query([]));
    await get("/api/v1/orders?status=PENDING");
    expect(Order.find).toHaveBeenCalledWith({ user: USER_ID, status: "PENDING" });
  });

  it("GET /funds returns this user's spendable and reserved cash", async () => {
    User.findById.mockResolvedValue({ cash: 12345.678, reservedCash: 500.004 });

    const res = await get("/api/v1/funds");

    expect(User.findById).toHaveBeenCalledWith(USER_ID, { cash: 1, reservedCash: 1 });
    expect(res.body).toEqual({ cash: 12345.68, reservedCash: 500 });
  });
});

describe("GET /stocks", () => {
  it("returns quotes with day change computed from the open price", async () => {
    Stock.find.mockReturnValue(query([{ symbol: "ITC", price: 200, open: 210 }]));

    const res = await get("/api/v1/stocks");

    expect(res.body).toEqual([{ symbol: "ITC", price: 200, day: "-4.76%", isDown: true }]);
  });
});

describe("POST /orders validation", () => {
  it.each([
    [{ name: "", qty: 1, mode: "BUY" }, /Invalid order/],
    [{ name: "ITC", qty: 1.5, mode: "BUY" }, /Invalid order/],
    [{ name: "ITC", qty: 0, mode: "BUY" }, /Invalid order/],
    [{ name: "ITC", qty: "1", mode: "BUY" }, /Invalid order/],
    [{ name: "ITC", qty: 1, mode: "HOLD" }, /Invalid order/],
    [{ name: "ITC", qty: 1, mode: "BUY", type: "STOP" }, /type must be MARKET or LIMIT/],
    [{ name: "ITC", qty: 1, mode: "BUY", type: "LIMIT" }, /Limit orders need a limitPrice/],
    [{ name: "ITC", qty: 1, mode: "BUY", type: "LIMIT", limitPrice: -5 }, /positive number/],
    [{ name: "ITC", qty: 1, mode: "BUY", type: "LIMIT", limitPrice: 10.123 }, /at most 2 decimal/],
    [{ name: "ITC", qty: 1, mode: "BUY", limitPrice: 10 }, /don't take a limitPrice/],
  ])("rejects %j with 400", async (body, message) => {
    const res = await post("/api/v1/orders", body);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
    expect(Stock.findOne).not.toHaveBeenCalled();
  });

  it("rejects an unknown status filter", async () => {
    const res = await get("/api/v1/orders?status=DONE");
    expect(res.status).toBe(400);
  });

  it("rejects a malformed order id on cancel", async () => {
    const res = await post("/api/v1/orders/not-an-id/cancel");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid order id.");
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("app", () => {
  it("GET /health responds ok", async () => {
    const res = await request(app).get("/health");
    expect(res.body).toEqual({ success: true, status: "ok" });
  });

  it("unknown routes return a JSON 404", async () => {
    const res = await request(app).get("/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
