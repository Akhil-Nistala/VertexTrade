import { jest } from "@jest/globals";

// Models are mocked: these check routing, auth, validation, per-user
// scoping, market-price fills, cash checks, and buy/sell rules without a
// live database.
const mockHolding = {
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  create: jest.fn(),
  deleteOne: jest.fn(),
};
const mockPosition = { find: jest.fn() };
const mockOrder = { find: jest.fn(), create: jest.fn() };
const mockStock = { find: jest.fn(), findOne: jest.fn() };
const mockUser = { findById: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn() };

jest.unstable_mockModule("../src/models/holding.model.js", () => ({ Holding: mockHolding }));
jest.unstable_mockModule("../src/models/position.model.js", () => ({ Position: mockPosition }));
jest.unstable_mockModule("../src/models/order.model.js", () => ({ Order: mockOrder }));
jest.unstable_mockModule("../src/models/stock.model.js", () => ({ Stock: mockStock }));
jest.unstable_mockModule("../src/models/user.model.js", () => ({
  User: mockUser,
  STARTING_CASH: 100000,
}));

const request = (await import("supertest")).default;
const { default: app } = await import("../src/app.js");
const { signSessionToken } = await import("../src/utils/tokens.js");

const USER_ID = "64b000000000000000000001";
const authCookie = `token=${signSessionToken({ _id: USER_ID })}`;

const ITC = { symbol: "ITC", price: 200, open: 210 };

beforeEach(() => {
  jest.clearAllMocks();
  mockStock.findOne.mockResolvedValue(ITC);
  mockOrder.create.mockImplementation(async (doc) => ({ _id: "o1", ...doc }));
});

describe("auth guard", () => {
  it.each([
    ["get", "/api/v1/holdings"],
    ["get", "/api/v1/positions"],
    ["get", "/api/v1/orders"],
    ["post", "/api/v1/orders"],
    ["get", "/api/v1/stocks"],
    ["get", "/api/v1/funds"],
  ])("%s %s returns 401 without a session", async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });
});

describe("data is scoped to the logged-in user", () => {
  it("GET /api/v1/holdings queries only this user's holdings", async () => {
    mockHolding.find.mockResolvedValue([{ name: "INFY" }]);

    const res = await request(app).get("/api/v1/holdings").set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ name: "INFY" }]);
    expect(mockHolding.find).toHaveBeenCalledWith({ user: USER_ID });
  });

  it("GET /api/v1/positions queries only this user's positions", async () => {
    mockPosition.find.mockResolvedValue([]);
    await request(app).get("/api/v1/positions").set("Cookie", authCookie);
    expect(mockPosition.find).toHaveBeenCalledWith({ user: USER_ID });
  });

  it("GET /api/v1/orders queries only this user's orders, newest first", async () => {
    const sort = jest.fn().mockResolvedValue([]);
    mockOrder.find.mockReturnValue({ sort });

    await request(app).get("/api/v1/orders").set("Cookie", authCookie);

    expect(mockOrder.find).toHaveBeenCalledWith({ user: USER_ID });
    expect(sort).toHaveBeenCalledWith({ _id: -1 });
  });

  it("GET /api/v1/funds returns this user's cash", async () => {
    mockUser.findById.mockResolvedValue({ cash: 12345.678 });

    const res = await request(app).get("/api/v1/funds").set("Cookie", authCookie);

    expect(mockUser.findById).toHaveBeenCalledWith(USER_ID, { cash: 1 });
    expect(res.body).toEqual({ cash: 12345.68 });
  });
});

describe("GET /api/v1/stocks", () => {
  it("returns quotes with day change computed from the open price", async () => {
    const lean = jest.fn().mockResolvedValue([{ symbol: "ITC", price: 200, open: 210 }]);
    mockStock.find.mockReturnValue({ sort: () => ({ lean }) });

    const res = await request(app).get("/api/v1/stocks").set("Cookie", authCookie);

    expect(res.body).toEqual([{ symbol: "ITC", price: 200, day: "-4.76%", isDown: true }]);
  });
});

describe("POST /api/v1/orders", () => {
  const placeOrder = (body) => request(app).post("/api/v1/orders").set("Cookie", authCookie).send(body);

  describe("BUY", () => {
    it("fills at the market price, ignoring any client-sent price", async () => {
      mockUser.findOneAndUpdate.mockResolvedValue({ cash: 99400 });
      mockHolding.findOne.mockResolvedValue(null);

      const res = await placeOrder({ name: "ITC", qty: 3, price: 1, mode: "BUY" });

      expect(res.status).toBe(201);
      expect(res.body.order.price).toBe(200);
      expect(res.body.cash).toBe(99400);
      expect(mockOrder.create).toHaveBeenCalledWith({
        user: USER_ID,
        name: "ITC",
        qty: 3,
        price: 200,
        mode: "BUY",
      });
      expect(mockHolding.create).toHaveBeenCalledWith(
        expect.objectContaining({ user: USER_ID, name: "ITC", qty: 3, avg: 200, isLoss: true })
      );
    });

    it("debits cash atomically, only if the balance covers the cost", async () => {
      mockUser.findOneAndUpdate.mockResolvedValue({ cash: 99400 });
      mockHolding.findOne.mockResolvedValue(null);

      await placeOrder({ name: "ITC", qty: 3, mode: "BUY" });

      expect(mockUser.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: USER_ID, cash: { $gte: 600 } },
        { $inc: { cash: -600 } },
        { new: true }
      );
    });

    it("rejects with 400 when funds are insufficient, without touching holdings or orders", async () => {
      mockUser.findOneAndUpdate.mockResolvedValue(null);
      mockUser.findById.mockResolvedValue({ cash: 100 });

      const res = await placeOrder({ name: "ITC", qty: 3, mode: "BUY" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        "Insufficient funds: this order costs ₹600.00 but you have ₹100.00."
      );
      expect(mockHolding.create).not.toHaveBeenCalled();
      expect(mockOrder.create).not.toHaveBeenCalled();
    });

    it("averages into an existing holding at the market price", async () => {
      mockUser.findOneAndUpdate.mockResolvedValue({ cash: 99600 });
      const existing = { qty: 2, avg: 100, price: 200, save: jest.fn() };
      mockHolding.findOne.mockResolvedValue(existing);

      await placeOrder({ name: "ITC", qty: 2, mode: "BUY" });

      expect(existing.qty).toBe(4);
      expect(existing.avg).toBe(150);
      expect(existing.save).toHaveBeenCalled();
    });

    it("refunds the debit if the holding can't be saved", async () => {
      mockUser.findOneAndUpdate.mockResolvedValue({ cash: 99400 });
      mockHolding.findOne.mockRejectedValue(new Error("db down"));
      const logSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await placeOrder({ name: "ITC", qty: 3, mode: "BUY" });

      expect(res.status).toBe(500);
      expect(mockUser.updateOne).toHaveBeenCalledWith({ _id: USER_ID }, { $inc: { cash: 600 } });
      expect(mockOrder.create).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  describe("SELL", () => {
    it("decrements the holding atomically and credits the proceeds", async () => {
      mockHolding.findOneAndUpdate.mockResolvedValue({ _id: "h1", qty: 3 });
      mockUser.findOneAndUpdate.mockResolvedValue({ cash: 100400 });

      const res = await placeOrder({ name: "ITC", qty: 2, mode: "SELL" });

      expect(res.status).toBe(201);
      expect(mockHolding.findOneAndUpdate).toHaveBeenCalledWith(
        { user: USER_ID, name: "ITC", qty: { $gte: 2 } },
        { $inc: { qty: -2 } },
        { new: true }
      );
      expect(mockUser.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: USER_ID },
        { $inc: { cash: 400 } },
        { new: true }
      );
      expect(mockHolding.deleteOne).not.toHaveBeenCalled();
      expect(res.body.cash).toBe(100400);
    });

    it("removes the holding when selling the full quantity", async () => {
      mockHolding.findOneAndUpdate.mockResolvedValue({ _id: "h1", qty: 0 });
      mockUser.findOneAndUpdate.mockResolvedValue({ cash: 100400 });

      await placeOrder({ name: "ITC", qty: 2, mode: "SELL" });

      expect(mockHolding.deleteOne).toHaveBeenCalledWith({ _id: "h1" });
    });

    it("rejects selling more than is held, without crediting cash or logging an order", async () => {
      mockHolding.findOneAndUpdate.mockResolvedValue(null);
      mockHolding.findOne.mockResolvedValue({ qty: 1 });

      const res = await placeOrder({ name: "ITC", qty: 5, mode: "SELL" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Cannot sell 5 ITC — you only hold 1.");
      expect(mockUser.findOneAndUpdate).not.toHaveBeenCalled();
      expect(mockOrder.create).not.toHaveBeenCalled();
    });
  });

  it("rejects an unknown symbol with 400", async () => {
    mockStock.findOne.mockResolvedValue(null);

    const res = await placeOrder({ name: "NOPE", qty: 1, mode: "BUY" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Unknown instrument: NOPE.");
    expect(mockUser.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it.each([
    [{ name: "", qty: 1, mode: "BUY" }],
    [{ name: "ITC", qty: 1.5, mode: "BUY" }],
    [{ name: "ITC", qty: 0, mode: "BUY" }],
    [{ name: "ITC", qty: "1", mode: "BUY" }],
    [{ name: "ITC", qty: 1, mode: "HOLD" }],
  ])("rejects invalid order %j with 400", async (body) => {
    const res = await placeOrder(body);
    expect(res.status).toBe(400);
    expect(mockStock.findOne).not.toHaveBeenCalled();
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
