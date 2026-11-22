import { jest } from "@jest/globals";

// The model layer is mocked so these are fast HTTP-contract tests that don't
// need a live database.
const mockUser = {
  exists: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
};
const mockGiveStarterPortfolio = jest.fn();

jest.unstable_mockModule("../src/models/user.model.js", () => ({ User: mockUser }));
jest.unstable_mockModule("../src/data/samplePortfolio.js", () => ({
  giveStarterPortfolio: mockGiveStarterPortfolio,
}));

const bcrypt = (await import("bcryptjs")).default;
const request = (await import("supertest")).default;
const { default: app } = await import("../src/app.js");
const { signSessionToken } = await import("../src/utils/tokens.js");

const sessionCookieFrom = (res) =>
  (res.headers["set-cookie"] ?? []).find((c) => c.startsWith("token="));

const USER_ID = "64b000000000000000000001";

beforeEach(() => jest.clearAllMocks());

describe("POST /api/v1/auth/signup", () => {
  it("creates the user, gives a starter portfolio, and sets an httpOnly session cookie", async () => {
    mockUser.exists.mockResolvedValue(null);
    mockUser.create.mockResolvedValue({ _id: USER_ID, name: "Alice", email: "alice@example.com" });

    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ name: " Alice ", email: " Alice@Example.com ", password: "password123" });

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({ id: USER_ID, name: "Alice", email: "alice@example.com" });

    // Input is normalized and only the hash is stored.
    const created = mockUser.create.mock.calls[0][0];
    expect(created).toMatchObject({ name: "Alice", email: "alice@example.com" });
    expect(created.password).toBeUndefined();
    expect(await bcrypt.compare("password123", created.passwordHash)).toBe(true);

    expect(mockGiveStarterPortfolio).toHaveBeenCalledWith(USER_ID);

    const cookie = sessionCookieFrom(res);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it("rejects a duplicate email with 409", async () => {
    mockUser.exists.mockResolvedValue({ _id: USER_ID });

    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ name: "Alice", email: "alice@example.com", password: "password123" });

    expect(res.status).toBe(409);
    expect(mockUser.create).not.toHaveBeenCalled();
  });

  it("rejects a short password with 400", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ name: "Alice", email: "alice@example.com", password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Password must be at least 8 characters.");
  });

  it("rejects an invalid email with 400", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ name: "Alice", email: "not-an-email", password: "password123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Enter a valid email address.");
  });
});

describe("POST /api/v1/auth/login", () => {
  const passwordHash = bcrypt.hashSync("password123", 4);

  it("logs in with correct credentials and sets the session cookie", async () => {
    mockUser.findOne.mockResolvedValue({ _id: USER_ID, name: "Alice", email: "alice@example.com", passwordHash });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "ALICE@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(mockUser.findOne).toHaveBeenCalledWith({ email: "alice@example.com" });
    expect(sessionCookieFrom(res)).toBeDefined();
  });

  it("gives the same 401 for a wrong password and an unknown email", async () => {
    mockUser.findOne.mockResolvedValueOnce({ _id: USER_ID, passwordHash });
    const wrongPassword = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "alice@example.com", password: "wrong-password" });

    mockUser.findOne.mockResolvedValueOnce(null);
    const unknownEmail = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@example.com", password: "password123" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    expect(sessionCookieFrom(wrongPassword)).toBeUndefined();
  });
});

describe("GET /api/v1/auth/me", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the user for a valid session", async () => {
    mockUser.findById.mockResolvedValue({ _id: USER_ID, name: "Alice", email: "alice@example.com" });
    const token = signSessionToken({ _id: USER_ID });

    const res = await request(app).get("/api/v1/auth/me").set("Cookie", `token=${token}`);

    expect(res.status).toBe(200);
    expect(mockUser.findById).toHaveBeenCalledWith(USER_ID);
    expect(res.body.user.email).toBe("alice@example.com");
  });

  it("rejects a tampered token", async () => {
    const token = signSessionToken({ _id: USER_ID }) + "x";
    const res = await request(app).get("/api/v1/auth/me").set("Cookie", `token=${token}`);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("clears the session cookie", async () => {
    const res = await request(app).post("/api/v1/auth/logout");
    expect(res.status).toBe(200);
    expect(sessionCookieFrom(res)).toMatch(/token=;/);
  });
});

describe("cookie settings in production", () => {
  const original = { NODE_ENV: process.env.NODE_ENV, COOKIE_SAMESITE: process.env.COOKIE_SAMESITE };
  const passwordHash = bcrypt.hashSync("password123", 4);

  const loginCookie = async () => {
    mockUser.findOne.mockResolvedValue({ _id: USER_ID, name: "Alice", email: "a@example.com", passwordHash });
    const res = await request(app).post("/api/v1/auth/login").send({ email: "a@example.com", password: "password123" });
    return sessionCookieFrom(res);
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("is Secure and SameSite=None by default (cross-site API)", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.COOKIE_SAMESITE;

    const cookie = await loginCookie();

    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=None/);
  });

  it("honours COOKIE_SAMESITE=lax when the frontend proxies /api", async () => {
    process.env.NODE_ENV = "production";
    process.env.COOKIE_SAMESITE = "lax";

    const cookie = await loginCookie();

    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });
});
