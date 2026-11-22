import { jest } from "@jest/globals";

// Models are mocked: these check routing, auth, validation, per-user
// scoping, and the buy/sell rules without a live database.
const mockHolding = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), deleteOne: jest.fn() };
const mockPosition = { find: jest.fn() };
const mockOrder = { find: jest.fn(), create: jest.fn() };

jest.unstable_mockModule("../src/models/holding.model.js", () => ({ Holding: mockHolding }));
jest.unstable_mockModule("../src/models/position.model.js", () => ({ Position: mockPosition }));
jest.unstable_mockModule("../src/models/order.model.js", () => ({ Order: mockOrder }));

const request = (await import("supertest")).default;
const { default: app } = await import("../src/app.js");
const { signSessionToken } = await import("../src/utils/tokens.js");

const USER_ID = "64b000000000000000000001";
const authCookie = `token=${signSessionToken({ _id: USER_ID })}`;

beforeEach(() => jest.clearAllMocks());

describe("auth guard", () => {
  it.each([
    ["get", "/allHoldings"],
    ["get", "/allPositions"],
    ["get", "/allOrders"],
    ["post", "/newOrder"],
  ])("%s %s returns 401 without a session", async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });
});

describe("data is scoped to the logged-in user", () => {
  it("GET /allHoldings queries only this user's holdings", async () => {
    mockHolding.find.mockResolvedValue([{ name: "INFY" }]);

    const res = await request(app).get("/allHoldings").set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ name: "INFY" }]);
    expect(mockHolding.find).toHaveBeenCalledWith({ user: USER_ID });
  });

  it("GET /allPositions queries only this user's positions", async () => {
    mockPosition.find.mockResolvedValue([]);
    await request(app).get("/allPositions").set("Cookie", authCookie);
    expect(mockPosition.find).toHaveBeenCalledWith({ user: USER_ID });
  });

  it("GET /allOrders queries only this user's orders, newest first", async () => {
    const sort = jest.fn().mockResolvedValue([]);
    mockOrder.find.mockReturnValue({ sort });

    await request(app).get("/allOrders").set("Cookie", authCookie);

    expect(mockOrder.find).toHaveBeenCalledWith({ user: USER_ID });
    expect(sort).toHaveBeenCalledWith({ _id: -1 });
  });
});

describe("POST /newOrder", () => {
  const placeOrder = (body) => request(app).post("/newOrder").set("Cookie", authCookie).send(body);

  it("opens a new holding on a BUY and logs the order", async () => {
    mockHolding.findOne.mockResolvedValue(null);

    const res = await placeOrder({ name: " ZOMATO ", qty: 3, price: 200, mode: "BUY" });

    expect(res.status).toBe(200);
    expect(mockHolding.findOne).toHaveBeenCalledWith({ user: USER_ID, name: "ZOMATO" });
    expect(mockHolding.create).toHaveBeenCalledWith(
      expect.objectContaining({ user: USER_ID, name: "ZOMATO", qty: 3, avg: 200 })
    );
    expect(mockOrder.create).toHaveBeenCalledWith({
      user: USER_ID,
      name: "ZOMATO",
      qty: 3,
      price: 200,
      mode: "BUY",
    });
  });

  it("averages into an existing holding on a BUY", async () => {
    const existing = { qty: 2, avg: 100, price: 120, save: jest.fn() };
    mockHolding.findOne.mockResolvedValue(existing);

    await placeOrder({ name: "ITC", qty: 2, price: 200, mode: "BUY" });

    expect(existing.qty).toBe(4);
    expect(existing.avg).toBe(150);
    expect(existing.save).toHaveBeenCalled();
  });

  it("rejects selling more than is held, without logging an order", async () => {
    mockHolding.findOne.mockResolvedValue({ qty: 1 });

    const res = await placeOrder({ name: "ITC", qty: 5, price: 200, mode: "SELL" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Cannot sell 5 ITC — you only hold 1.");
    expect(mockOrder.create).not.toHaveBeenCalled();
  });

  it("removes the holding when selling the full quantity", async () => {
    mockHolding.findOne.mockResolvedValue({ _id: "h1", qty: 2 });

    const res = await placeOrder({ name: "ITC", qty: 2, price: 200, mode: "SELL" });

    expect(res.status).toBe(200);
    expect(mockHolding.deleteOne).toHaveBeenCalledWith({ _id: "h1" });
  });

  it.each([
    [{ name: "", qty: 1, price: 10, mode: "BUY" }],
    [{ name: "ITC", qty: 1.5, price: 10, mode: "BUY" }],
    [{ name: "ITC", qty: 1, price: -1, mode: "BUY" }],
    [{ name: "ITC", qty: "1", price: 10, mode: "BUY" }],
    [{ name: "ITC", qty: 1, price: 10, mode: "HOLD" }],
  ])("rejects invalid order %j with 400", async (body) => {
    const res = await placeOrder(body);
    expect(res.status).toBe(400);
    expect(mockHolding.findOne).not.toHaveBeenCalled();
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
