# VertexTrade: The Complete Interview Guide

One file for everything: the pitch, the architecture, every file in the code, every flow, the design decisions, the weak spots, and a bank of interview questions with answers.

**How to use it**
- **Night before:** §1 (pitch), §10 (decisions), §11 (limitations), §14 (rapid-fire facts).
- **First pass:** read §1 → §9 in order.
- **Drilling:** §12 and §13. Cover the answer, say yours out loud, then compare.

**Contents**
§1 Pitch · §2 Architecture · §3 Tech stack and why · §4 Folder map · §5 Backend, file by file · §6 Frontend, file by file · §7 Every flow · §8 Auth and security concepts · §9 Tests · §10 Design decisions · §11 Limitations · §12 Project questions · §13 General technical questions · §14 Rapid-fire facts

---

## 1. The pitch

**30 seconds:**
> VertexTrade is a full-stack stock trading platform. It has three apps: a React marketing site, a React trading dashboard, and an Express + MongoDB API. Users sign up with ₹1,00,000 of virtual cash and place market and limit orders that the server fills at live simulated prices. Limit orders reserve funds when placed and are matched on every price tick, and every order runs in a MongoDB transaction. Auth is bcrypt plus a JWT in an httpOnly cookie, and every query is scoped to the logged-in user. The API has unit tests and integration tests that prove the race conditions are handled.

**What to emphasise (pick two or three):**
- **Per-user data isolation** — the user id always comes from the verified token, never from the request body, so one user can't read or trade another's portfolio.
- **Real business logic** — the server picks the fill price (never the client), buys check the cash balance, buys average into the cost basis, sells are rejected if they exceed what you hold, and a rejected order is never logged.
- **Limit orders done properly** — funds are reserved at placement (so you can't double-commit cash or shares), a matcher fills orders on each price tick, and a conditional update on `status: PENDING` guarantees each order is filled *or* cancelled exactly once.
- **Transactional, race-safe money updates** — every order operation runs in one MongoDB transaction, and every balance change inside it is a conditional atomic update. Integration tests fire concurrent requests at a real replica set to prove it.
- **Secure-by-default auth** — httpOnly + SameSite cookie, no user enumeration (same message *and* similar timing for wrong email vs wrong password).
- **Testable backend** — `app.js` / `server.js` split, so 63 unit tests run without a database; 11 integration tests cover real concurrency and rollback.

---

## 2. Architecture

```
 frontend :5173            dashboard :5174                    backend :3002              MongoDB
 (marketing, static)       (trading app)                      (Express API)
     │                          │                                  │                         │
     │ Login/Signup links ────▶ │                                  │                         │
     │                          │ POST /api/v1/auth/login ───────▶ │ bcrypt.compare ───────▶ │ users
     │                          │ ◀── Set-Cookie: token=JWT        │                         │
     │                          │     (httpOnly, SameSite=Lax)     │                         │
     │                          │                                  │                         │
     │                          │ GET /api/v1/holdings (cookie) ─▶ │ requireAuth → userId    │
     │                          │   every 5s (polling)             │ Holding.find({user}) ─▶ │ holdings
     │                          │                                  │                         │
     │                          │                                  │ price simulator ──────▶ │ stocks →
     │                          │                                  │ every 4s                │ holdings, positions
     │                          │                                  │ → matcher ────────────▶ │ pending orders
```

- **Three independently runnable apps.** The marketing site never talks to the API; it just links to the dashboard.
- **The dashboard and API are on different ports (origins)** but the same *site* (`localhost`), which is why a `SameSite=Lax` cookie works with `withCredentials: true` and a CORS whitelist.
- **One market for everyone:** the `stocks` collection holds one price per symbol; the simulator moves it, copies it onto every holding and position, then runs the limit-order matcher.
- **MongoDB runs as a replica set** (Atlas, or a single local node) because orders use transactions.
- **"Real-time" is polling**, not WebSockets: the server mutates prices every 4s, the dashboard re-fetches every 5s.

---

## 3. Tech stack and why

| Choice | Why | Alternative you can mention |
|---|---|---|
| **React + Vite** | Fast dev server, simple build, standard | Next.js (SSR not needed for an authenticated dashboard) |
| **MUI + Chart.js** (dashboard) | Icons/tooltips and charts without building from scratch | Recharts |
| **Bootstrap** (marketing) | Static pages, quick responsive layout | Tailwind |
| **Express** | Minimal, well known, middleware model fits auth/validation | Fastify, NestJS |
| **MongoDB + Mongoose** | Flexible documents, schemas in Mongoose, multi-document transactions on a replica set | PostgreSQL — numeric types and check constraints suit money even better |
| **bcryptjs** | Slow, salted password hashing; pure JS so no native build | argon2 |
| **jsonwebtoken** | Stateless sessions, no session store needed | express-session + Redis |
| **zod** | Declarative request validation with typed, normalized output | Joi, express-validator |
| **Jest + supertest** | Send real HTTP requests to the app in-process; unit tests mock models, integration tests use a real replica set | Vitest |
| **concurrently** | One `npm run dev` starts all three apps | Docker Compose |

---

## 4. Folder map

```
VertexTrade/
├── package.json              # root scripts: dev (all apps), install:all, test, seed
├── render.yaml               # Render blueprint for the API
├── backend/
│   ├── src/
│   │   ├── app.js            # builds the Express app (no DB, no listen)
│   │   ├── server.js         # entry: check env, connect DB, open market, expire stale orders, listen, simulate
│   │   ├── seed.js           # wipe DB, create demo user + starter portfolio
│   │   ├── config/db.js      # connect + check the DB supports transactions
│   │   ├── routes/           # auth, holding, position, order, stock, funds
│   │   ├── controllers/      # auth, holding, position, order, stock, funds
│   │   ├── middleware/       # auth (requireAuth), validate (zod), errorHandler
│   │   ├── validators/       # auth, order (zod schemas)
│   │   ├── models/           # user, stock, holding, position, order
│   │   ├── services/         # trading (place/settle/cancel/expire), matching, funds, priceSimulator
│   │   ├── utils/            # ApiError, asyncHandler, tokens, formatPercent, money, transaction
│   │   └── data/             # market.js (stock universe, openMarket), samplePortfolio.js
│   └── tests/                # auth, orders.api, trading (mocked) + integration/ (replica set)
├── dashboard/src/
│   ├── App.jsx               # /login, /signup, /* → withAuth(Home)
│   ├── pages/                # Authentication, Home, Summary, Orders, Holdings, Positions, Funds, Apps
│   ├── components/           # TopBar, Menu, WatchList, OrderActionWindow, Dashboard, charts, Logo
│   ├── context/              # AuthContext, GeneralContext
│   ├── config/api.js         # axios instance
│   ├── utils/withAuth.jsx    # route guard (HOC)
│   ├── hooks/                # usePolling, usePriceFlash, useFunds
│   └── styles/
└── frontend/src/
    ├── App.jsx
    ├── pages/                # Home, Products, Pricing, About, Support, Signup, NotFound
    └── components/           # Navbar, Footer, Logo, OpenAccount + per-page sections
```

**The layering rule:** route → middleware (auth, validation) → controller → service/model. Controllers stay thin; business rules (fills, reservations, cash and share checks, cost basis) live in the trading service; when orders fill lives in the matching service.

---

## 5. Backend, file by file

### Entry points
- **`src/app.js`** — creates the Express app; registers CORS (origin whitelist from `CLIENT_ORIGINS`, `credentials: true`), `cookie-parser`, `express.json` (40kb limit; no form parser, so the API only accepts JSON — part of the CSRF defence), `GET /health`, the six routers under `/api/v1/...` (auth, holdings, positions, orders, stocks, funds), then the 404 handler and error handler. **Exports the app without listening** — that's what makes it testable.
- **`src/server.js`** — fails fast if `JWT_SECRET` is missing, connects MongoDB via `connectDB(MONGO_URL)` (which also fails fast on a standalone server — transactions need a replica set), runs `openMarket()`, expires the previous session's pending orders (`expirePendingOrders()`), calls `app.listen`, then `startPriceSimulator()`. Any startup error → log and `process.exit(1)`.
- **`src/seed.js`** — connects, deletes all users/holdings/positions/orders/stocks, re-opens the market, creates `demo@vertextrade.dev / demo1234` with a bcrypt hash, gives it the starter portfolio, disconnects.

### Routes (thin — just wiring)
- **`auth.routes.js`** — `POST /signup` (validate → signup), `POST /login` (validate → login), `POST /logout`, `GET /me` (requireAuth → me).
- **`holding.routes.js` / `position.routes.js`** — `router.use(requireAuth)` then `GET /`.
- **`order.routes.js`** — `router.use(requireAuth)`; `GET /` (validates `?status`), `POST /` (validates with `placeOrderSchema`), `POST /:id/cancel` (validates the id).
- **`stock.routes.js` / `funds.routes.js`** — `router.use(requireAuth)` then `GET /`.

### Middleware
- **`auth.middleware.js` → `requireAuth`** — reads `req.cookies.token`, `jwt.verify`s it (signature + expiry), sets `req.userId = payload.sub`. Missing → `401 "Not logged in."`; invalid/expired → `401 "Session expired…"`.
- **`validate.middleware.js` → `validate(schema)`** — `schema.safeParse(req.body)`; on failure, `ApiError(400, firstIssueMessage, fieldErrors)`; on success, **replaces `req.body` with the parsed data** (trimmed, lowercased email, etc.).
- **`errorHandler.js`** — `notFoundHandler` turns unmatched routes into `ApiError(404)`. `errorHandler`: `ApiError` → its status and message; anything else → log it, respond `500 "Something went wrong"` (no internals leaked). Shape: `{ success: false, message, errors? }`.

### Controllers
- **`auth.controller.js`**
  - `signup` — `User.exists({email})` → `409`; `bcrypt.hash(password, 10)`; create user; `giveStarterPortfolio(user._id)`; set cookie; `201 { success, user }`.
  - `login` — `User.findOne({email})`; `bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH)`; if no user or mismatch → `401 "Incorrect email or password."` Comparing against a dummy hash when the user doesn't exist keeps the response time similar, so timing can't reveal registered emails.
  - `logout` — clears the cookie (must pass the same options it was set with).
  - `me` — `User.findById(req.userId)`; returns `{ id, name, email }` (never the hash).
- **`holding.controller.js` / `position.controller.js`** — `Model.find({ user: req.userId })`.
- **`order.controller.js`**
  - `getOrders` — `Order.find({ user, status? }).sort({_id: -1})` (ObjectIds embed creation time, so `_id` desc ≈ newest first).
  - `placeOrder` — hands `req.body` (`{ name, qty, mode, type, limitPrice? }`) to the trading service; `201 { success, order, funds }`.
  - `cancelOrder` — `cancelOrder(req.userId, req.params.id)`; `200 { success, order, funds }`.
- **`stock.controller.js`** — `Stock.find().sort({symbol: 1})`, returns `{ symbol, price, day, isDown }` with day change computed from `open`.
- **`funds.controller.js`** — `getFunds(req.userId)` → `{ cash, reservedCash }`.

### Services

**`trading.service.js`** — all order logic. Every public function runs in one transaction (`withTransaction`), and every balance change inside it is a conditional atomic update.

*Where the money is:* `user.cash` (spendable), `user.reservedCash` (held for pending buys), `holding.qty` (owned, *including* reserved), `holding.reservedQty` (held for pending sells). Available shares = `qty − reservedQty`.

*Small building blocks* (each one atomic, each takes the session):
| Function | Update |
|---|---|
| `debitCash` | `{ cash: { $gte: amount } }` → `$inc cash −amount`; no match → `400 Insufficient funds` |
| `reserveCash` | same condition → `$inc cash −amount, reservedCash +amount` |
| `releaseCash` | `$inc cash +amount, reservedCash −amount` |
| `spendReservedCash` | `$inc reservedCash −reserved, cash +(reserved − cost)` (refunds the unused part) |
| `removeShares` | `$expr: qty − reservedQty ≥ n` → `$inc qty −n`; deletes the holding at 0 |
| `reserveShares` | same condition → `$inc reservedQty +n` |
| `releaseShares` | `$inc reservedQty −n` |
| `deliverReservedShares` | `$inc qty −n, reservedQty −n`; deletes at 0 |
| `addShares` | create at the fill price, or average in: `newAvg = (avg·qty + price·n) / (qty + n)` |

*Public operations:*
- **`placeOrder(userId, { name, qty, mode, type, limitPrice })`** — look up the stock (`400` if unknown). If it's a **market** order, or a **limit** order the market already satisfies (`canFillAt`), fill now at the **market price**: debit + add shares, or remove shares + credit, then create a `FILLED` order. Otherwise **reserve** (`qty × limitPrice` of cash for a buy, `qty` shares for a sell) and create a `PENDING` order with `reserved`.
- **`settleOrder(orderId, quote)`** — claim the order with `findOneAndUpdate({ _id, status: "PENDING", $or: [{ mode: BUY, limitPrice ≥ price }, { mode: SELL, limitPrice ≤ price }] }, { status: "FILLED", price, closedAt })`. No match → return `null` (already closed, or the price doesn't qualify). Buy: spend the reserve, refund the difference, add shares at the fill price. Sell: deliver the reserved shares, credit the proceeds.
- **`cancelOrder(userId, orderId)`** — claim `{ _id, user, status: "PENDING" }` → `CANCELLED` and release the reserve. No match → `404` if the order isn't this user's, `409 "already filled/cancelled/expired"` otherwise.
- **`expireOrder(orderId)`** — same as cancel with status `EXPIRED`, no user check (system action).
- **`canFillAt(mode, limit, price)`** — buy: `price ≤ limit`; sell: `price ≥ limit`.

**`matching.service.js`**
- **`matchOrders(quotes)`** — after each tick: one query for `PENDING` orders on the ticked symbols (index `{ status, name }`), oldest first; for each one the new price satisfies, `settleOrder`. Sequential, so one user's orders don't fight over their cash document; one failure is logged and the rest continue.
- **`expirePendingOrders()`** — at startup, expires every pending order (day orders).

**`funds.service.js`** — `getFunds(userId)` → `{ cash, reservedCash }` rounded to paise.

**`priceSimulator.js`** — every 4s: move each **stock** ±0.05–0.4% (`bulkWrite`), copy prices onto holdings and positions (`bulkWrite`: `price`, `day` vs `open`, `net` vs `avg`, `isLoss`), then `matchOrders`. The next tick is scheduled only after the previous one finishes (`setTimeout` loop), so slow matching never overlaps.

### Models
- **`user.model.js`** — `name`, `email` (unique, lowercase, trimmed), `passwordHash`, `cash` (default ₹1,00,000, min 0), `reservedCash` (default 0, min 0), timestamps.
- **`stock.model.js`** — `symbol` (unique), `price`, `open`. The single source of truth for prices.
- **`holding.model.js`** — `user`, `name, qty, reservedQty, avg, price, net, day, isLoss`. **Unique index `{ user, name }`** — one holding per symbol, and it serves "this user's holdings" queries.
- **`position.model.js`** — `user, product, name, qty, avg, price, net, day, isLoss`.
- **`order.model.js`** — `user, name, qty, mode`, `type` (MARKET/LIMIT), `status` (PENDING/FILLED/CANCELLED/EXPIRED), `limitPrice`, `reserved`, `price` (actual fill price), `closedAt`, timestamps. Index `{ status, name }` for the matcher.

### Validators (zod)
- **`auth.validator.js`** — signup: non-empty trimmed name, valid email (trimmed + lowercased), password ≥ 8. Login: email + password strings.
- **`order.validator.js`** — `placeOrderSchema`: name, integer `qty > 0`, `mode` BUY/SELL, `type` MARKET/LIMIT (default MARKET), `limitPrice` positive with ≤ 2 decimals. A `superRefine` requires `limitPrice` for LIMIT and rejects it for MARKET. **No fill-price field** — unknown keys are stripped; `z.number()` rejects `"5"`. Also `orderIdParamsSchema` (24-hex id) and `listOrdersQuerySchema` (status enum).

### Utils
- **`ApiError`** — `Error` + `statusCode` + optional `details`.
- **`asyncHandler(fn)`** — wraps async handlers, forwards rejections to `next(err)`. Without it, Express 4 never responds to a thrown async error and the request hangs.
- **`tokens.js`** — `signSessionToken` (`{ sub: userId }`, 7d), `verifySessionToken`, `setSessionCookie` (httpOnly, 7-day maxAge, `secure` in production, `sameSite` from `COOKIE_SAMESITE` or `lax` in dev / `none` in production), `clearSessionCookie`.
- **`money.js`** — `roundMoney` (to paise) and `percentChange`.
- **`transaction.js`** — `withTransaction(work)`: starts a session, runs `work(session)` inside `session.withTransaction` (which retries on transient errors such as write conflicts), returns the result, always ends the session.
- **`data/market.js`** — the 18-symbol universe. `openMarket()` upserts missing stocks (`$setOnInsert`, so existing prices are kept), sets every `open` to the current price (a new "trading day" per server start), and backfills fields added later (`cash`, `reservedCash`, `reservedQty`, and order `type`/`status` on old orders).
- **`data/samplePortfolio.js`** — 13 holdings + 2 positions; `giveStarterPortfolio(userId)` inserts copies tagged with the user.

---

## 6. Frontend, file by file

### Dashboard
- **`main.jsx`** — mounts `<App />` inside `<BrowserRouter>`.
- **`App.jsx`** — wraps everything in `AuthProvider`. Routes: `/login` and `/signup` → `Authentication` (with `mode`), `/*` → `withAuth(Home)`.
- **`config/api.js`** — axios instance, `baseURL = VITE_API_URL + "/api/v1"`, **`withCredentials: true`** so the browser sends and accepts the cookie cross-origin.
- **`context/AuthContext.jsx`** — holds `user` and `checking`. On mount calls `GET /auth/me` (the page can't read an httpOnly cookie, so it asks the server). Exposes `login`, `signup`, `logout`. Registers an **axios response interceptor**: any `401` → `setUser(null)`, which makes the guard redirect to login.
- **`utils/withAuth.jsx`** — HOC. While `checking` → "Loading…". No user → `<Navigate to="/login" state={{ from }}>`. Otherwise render the page.
- **`pages/Authentication.jsx`** — one form for both modes. Already logged in → redirect. On submit → `login`/`signup`, then navigate to `from` (where they were headed) or `/`. Shows the server's error message.
- **`pages/Home.jsx`** — `TopBar` + `Dashboard`.
- **`components/Dashboard.jsx`** — `WatchList` (inside `GeneralContextProvider`) + nested routes: `/` Summary, `/orders`, `/holdings`, `/positions`, `/funds`, `/apps`.
- **`components/Menu.jsx`** — nav links, user initials + name, dropdown with email and **Log out**.
- **`components/WatchList.jsx`** — polls `GET /stocks` every 5s, search filter (`useMemo`), price flashes via `usePriceFlash`, hover actions open the order window, doughnut chart.
- **`context/GeneralContext.jsx`** — tracks whether the order window is open, for which symbol, BUY or SELL.
- **`components/OrderActionWindow.jsx`** — Market / Limit toggle; qty, plus a limit price (pre-filled with the market price) for limit orders. Shows the live market price, available cash, and a note: what gets reserved, or that the limit is already met and it fills now. Posts `{ name, qty, mode, type, limitPrice? }`; shows server errors inline.
- **`pages/Orders.jsx`** — Open tab (pending orders: limit, reserved amount, **Cancel** button) and History tab (type, fill price, status). Polls `/orders`; after a cancel it refetches, so a cancel that lost a race shows the order's real status.
- **`pages/Holdings.jsx`, `Positions.jsx`, `Summary.jsx`** — fetch with `usePolling(fn, 5000)`; Holdings/Positions use `usePriceFlash` to flash rows, and Holdings shows "(n reserved)". Summary shows cash, invested amount, account value (cash + reserved + holdings), and P&L.
- **`hooks/usePolling.js`** — runs the callback immediately, then on an interval; stores the callback in a ref so the interval isn't re-created when the callback changes.
- **`hooks/usePriceFlash.js`** — remembers previous prices in a ref; returns `{ id: "tick-up" | "tick-down" }` for changed rows, cleared after 900ms.
- **`hooks/useFunds.js`** — polls `GET /funds`, returns `{ cash, reservedCash }`; also exports `formatRupees` (Indian digit grouping).
- **`pages/Funds.jsx`** — available cash, reserved for open orders, invested, holdings value, account value, starting balance — all real.
- **`pages/Apps.jsx`** — illustrative static content.

### Marketing site
- **`App.jsx`** — `Navbar`, routes to the pages, `Footer`.
- **`components/Navbar.jsx`** — Login → `VITE_DASHBOARD_URL/login`; Signup → `/signup`.
- **`pages/Signup.jsx`** — immediately `window.location.replace`s to the dashboard's signup (auth lives in one app).
- Everything else is static Bootstrap content.

---

## 7. Every flow

### Signup
1. Dashboard `/signup` → `POST /api/v1/auth/signup { name, email, password }`.
2. zod validates and normalizes (trim, lowercase email, password ≥ 8) → `400` with the first message if invalid.
3. Email exists → `409`.
4. `bcrypt.hash(password, 10)` → `User.create` → starter portfolio inserted with `user: _id`.
5. JWT `{ sub: userId }` signed, set as httpOnly cookie → `201 { user }`.
6. `AuthContext` sets `user` → navigate to `/` → `withAuth` lets it through.

### Returning visit (session restore)
1. Page loads; `user` is null, `checking` is true → guard shows "Loading…".
2. `GET /auth/me` — browser attaches the cookie automatically.
3. Valid → `user` set → dashboard renders. `401` → `user` null → redirect to `/login`.

### Login
Same as signup from step 5, after `User.findOne` + `bcrypt.compare`. Wrong email or password → identical `401`.

### Placing a market order
1. Hover a watchlist row → Buy/Sell → `GeneralContext.openOrderWindow(symbol, mode)`.
2. Market selected, enter qty → `POST /api/v1/orders { name, qty, mode, type: "MARKET" }`.
3. `requireAuth` → `req.userId`; `validate(placeOrderSchema)` → `400` if bad.
4. In one transaction: look up the stock; BUY → atomic debit if cash ≥ cost, add shares; SELL → atomic decrement if available shares ≥ qty, credit proceeds; create a `FILLED` order at the market price.
5. `201 { order, funds }`. Window closes; the next poll shows the new holding, order, and balance.

### Placing a limit order
1. Limit selected, enter qty and limit → `POST /api/v1/orders { …, type: "LIMIT", limitPrice }`.
2. If the market already satisfies the limit → fills now at the market price (same as a market order, recorded as LIMIT).
3. Otherwise, in one transaction: reserve (buy: `cash → reservedCash`, `qty × limit`; sell: `reservedQty += qty`) and create a `PENDING` order. `400` if there isn't enough to reserve.
4. It appears under Orders → Open.

### A limit order filling
1. A tick moves ITC to ₹185. The matcher finds pending ITC orders and checks each limit.
2. A buy with limit ₹190: `settleOrder` claims it (`PENDING → FILLED`, only if still pending and 185 ≤ 190), spends the ₹570 reserve on the ₹555 cost, returns ₹15 to cash, adds 3 shares at avg ₹185 — all in one transaction.
3. Next poll: it moves to History as FILLED at 185.

### Cancelling
1. Orders → Open → Cancel → `POST /api/v1/orders/:id/cancel`.
2. In one transaction: claim `PENDING → CANCELLED` (only the owner's order), release the reserve.
3. If the matcher filled it a moment earlier, the claim fails → `409 "This order is already filled."` and the UI refetches.

### Live prices
- Server: every 4s, the simulator moves every stock, then copies each new price onto all holdings and positions of that symbol.
- Client: every 5s, pages re-fetch; `usePriceFlash` compares with previous prices and flashes changed rows.

### Logout and expiry
- Logout → `POST /auth/logout` clears the cookie → `user` null → redirect to login.
- Token expires (7 days) or is tampered with → next request `401` → interceptor clears `user` → redirect.

---

## 8. Auth and security concepts

**Hashing vs encryption.** Hashing is one-way; you can't get the password back. bcrypt is deliberately slow (cost factor 10 = 2¹⁰ rounds) and salted (random salt stored inside the hash), so identical passwords produce different hashes and rainbow tables are useless.

**JWT.** `header.payload.signature`, base64url-encoded. The payload is **readable by anyone** — only the signature (HMAC-SHA256 with `JWT_SECRET`) proves it wasn't modified. Store ids, never secrets. VertexTrade's payload is just `{ sub: userId, iat, exp }`.

**Why a cookie and not localStorage?** JavaScript can read localStorage, so any XSS bug can steal the token. An **httpOnly** cookie can't be read by JavaScript at all. Trade-off: cookies are sent automatically, which opens CSRF — handled by SameSite.

**SameSite.**
- `Strict` — never sent on cross-site requests (even clicking a link in).
- `Lax` (VertexTrade) — sent on top-level GET navigations, **not** on cross-site POSTs, fetches, or iframes. Blocks classic CSRF form posts.
- `None` — always sent; requires `Secure`. Needed if the frontend and API are on different *sites* in production.

**Origin vs site.** Origin = scheme + host + port. Site = scheme + registrable domain. `localhost:5174` and `localhost:3002` are different origins (so CORS applies) but the same site (so a Lax cookie is sent).

**CORS.** A browser rule, not server security: it decides whether page JavaScript may *read* a cross-origin response. With credentials, the server must echo an explicit origin (not `*`) and send `Access-Control-Allow-Credentials: true`. VertexTrade whitelists `CLIENT_ORIGINS`.

**IDOR (Insecure Direct Object Reference).** Letting a client say "give me user 42's orders". Prevented by never accepting a user id from the client — every query uses `req.userId` from the verified token.

**User enumeration.** Revealing which emails are registered. Prevented by identical login errors and a dummy bcrypt compare so timing matches. (Signup does return `409` for a taken email — a common, accepted trade-off for usability.)

**Input validation.** zod on every write: types, ranges, enums, trimming. `express.json` limit (40kb) caps body size.

---

## 9. Tests

Two layers: fast unit tests that run anywhere, and integration tests that prove the concurrency guarantees on a real database.

**Unit tests — `npm test` (63, no database).** `tests/support/mockModels.js` replaces the Mongoose models via `jest.unstable_mockModule`, and replaces `withTransaction` with one that runs the callback immediately with a fake session — so tests can assert every write carried that session (i.e. ran inside the transaction). Tests use **supertest** to send real HTTP requests to `app.js` in-process.
- **`auth.test.js` (12):** signup normalizes input, stores only a hash, sets an httpOnly + SameSite cookie; production cookies are `Secure` and `SameSite=None` by default or `Lax` with `COOKIE_SAMESITE`; duplicate email `409`; bad input `400`; wrong password and unknown email give the **same** `401`; `/me` with no, valid, and tampered tokens; logout clears the cookie.
- **`orders.api.test.js` (27):** the auth guard on all seven data routes; per-user scoping (holdings, positions, orders with and without `?status`, funds); stock quotes; ten invalid order bodies (including limit without `limitPrice`, market with one, 3-decimal limits); bad status filter; malformed order id; `/health`; JSON 404.
- **`trading.test.js` (24):** market fills at the market price even when the client sends `price: 1`; the exact conditional updates (`{ cash: { $gte: 600 } }`, the `$expr` available-shares check); insufficient funds and oversell create nothing; averaging; limit buy/sell reserve exactly the right amount; marketable limits fill now at the market price; settle claims with the price condition and refunds the unused reserve (₹570 reserved, ₹555 cost → ₹15 back); cancel releases cash or shares, `404`, `409`; matching settles only qualifying orders and survives a failing one; expiry releases reserves.

**Integration tests — `npm run test:integration` (11, real replica set).** Run against `vertextrade_test` (refuses any database not ending in `_test`, since it's wiped between tests).
- Two concurrent ₹800 buys with ₹1000 cash → **exactly one succeeds**, cash ends at ₹200.
- Two concurrent sells of the same shares → exactly one succeeds.
- `Order.create` forced to fail after the debit → **cash and holding are rolled back**.
- Limit buy reserves, settles below the limit, refunds the difference; reserved cash can't be spent by a market order; reserved shares can't be sold; cancel releases them.
- `settleOrder` called twice at once → **filled once**.
- Settle racing cancel → **exactly one wins**, and balances match whichever did.
- The matcher fills only orders the price reaches; expiry releases every reserve.

**Not covered yet:** the React apps (no frontend tests) and CI.

## 10. Design decisions (and how to defend them)

**Single JWT cookie instead of access + refresh tokens.** Simpler, no token store, and the httpOnly cookie removes the main reason for short-lived access tokens (XSS theft). Cost: can't revoke a token before it expires — logout only clears the cookie in that browser. Next step: refresh-token rotation or a server-side denylist.

**User id from the token, never the request.** The single most important rule for multi-user data. Every query includes `user: req.userId`.

**The server sets the price.** Orders carry only symbol, qty, and side; the fill price comes from the `stocks` collection. Originally the client sent the price — a user could have bought at ₹1. Fixing that is a good story: "never trust the client with anything that decides money".

**Transactions *and* conditional updates.** A transaction makes the order, cash, and holding change together — a crash halfway rolls everything back. Conditional updates (`findOneAndUpdate({ cash: { $gte: cost } }, { $inc: … })`) make each balance check-and-change one atomic step, so concurrent requests can't both pass a check. They solve different problems; you want both. (An earlier version had no transactions and refunded the debit by hand if the holding save failed — moving to a replica set removed that compensating code.)

**Reserve at placement.** A pending buy moves `qty × limit` out of `cash`; a pending sell marks shares as reserved. Without this you could place ten ₹1 lakh orders against one ₹1 lakh balance and only find out at fill time. Reserving at the *limit* price is the worst case, so a fill can never cost more than what's held; any difference is refunded.

**Two different reservation shapes, on purpose.** Cash moves into a separate `reservedCash` bucket, so every existing "`cash >= cost`" check automatically sees only free cash. Shares stay in `qty` with `reservedQty` alongside, so holdings, portfolio value, and P&L keep counting shares you still own; only sells check `qty − reservedQty`.

**Exactly-once fills with a status claim.** Settle and cancel both start with `findOneAndUpdate({ _id, status: "PENDING" }, …)`. Only one caller can move an order out of PENDING, so a double settle or a settle racing a cancel can't double-spend. Settle also puts the limit check in the same filter, so it's safe to call with any price.

**Limit orders fill at the market price, not the limit.** A buy limit of 200 with the market at 185 fills at 185 — the limit is the worst acceptable price. That's how exchanges treat them.

**Day orders.** Pending orders expire when the server restarts (the market "reopens"). Simple, and it means reserves can't be stuck forever.

**Matching in the simulator loop, sequentially.** Prices only change on a tick, so that's the only moment an order can become fillable. Settling one order at a time avoids write conflicts between one user's orders; the loop schedules the next tick only after the previous finishes.

**One shared price table.** Prices used to live on each user's holding, so they drifted apart per user. Now there's one `Stock` per symbol and holdings copy from it.

**Validate, then fill, then log.** Every rejection (unknown symbol, funds, oversell) throws before `Order.create`, so the order history only contains real fills.

**`app.js` / `server.js` split.** Tests import the app without a database or port; the server file is the only place with side effects.

**Central error handler + `asyncHandler`.** One response shape; unknown errors never leak stack traces; async errors can't hang requests.

**Validation with zod in middleware.** Controllers receive clean, normalized data and don't repeat checks.

**Polling instead of WebSockets.** Simple, works through any proxy, fine at 5s granularity for a demo. WebSockets (Socket.IO) would push updates instantly and cut wasted requests.

**Two frontend apps.** Marketing is static and public; trading is authenticated and data-heavy. Separate deploys, separate concerns.

**Starter portfolio on signup.** A new user sees a working dashboard immediately instead of an empty page.

**`user` field indexed.** Every query filters by user, so the index keeps reads fast as data grows.

---

## 11. Known limitations (say these before they ask)

- **Order types.** Market and day limit orders only — no stop-loss, no good-till-cancelled, no partial fills (any quantity fills at once in a simulated market).
- **Matching lives in the API process.** Fine for one instance. With several, each would run the matcher; the status claim keeps fills correct, but it's wasted work — a real system runs one dedicated matching worker (or a queue).
- **Matching scans pending orders per tick.** One indexed query per tick, then a filter in code. At scale you'd query by price range (`limitPrice ≥ price` for buys) or keep an in-memory order book.
- **Money as floats.** Rupee floats rounded to paise; integer paise would avoid drift entirely.
- **Simulator rewrites every holding every 4s.** `bulkWrite`, but O(all holdings). At scale, holdings would reference the stock and the price would be joined at read time.
- **Simulated market.** Random-walk prices; no margin or adding/withdrawing funds. The "day" opens when the server starts.
- **Auth gaps:** no rate limiting on login, no email verification or password reset, tokens can't be revoked early.
- **No frontend tests or CI.**

---

## 12. Project questions

**Walk me through what happens when a user logs in.**
The dashboard posts email and password to `/api/v1/auth/login`. zod normalizes the email. The controller finds the user and runs `bcrypt.compare` — against a dummy hash if the user doesn't exist, so timing is similar. On success it signs a JWT with the user id as `sub`, sets it as an httpOnly, SameSite=Lax cookie for 7 days, and returns the public user. The dashboard stores the user in context and navigates to where they were going.

**How do you make sure one user can't see another user's data?**
`requireAuth` puts the user id from the verified JWT on `req.userId`, and every query filters by it: `Holding.find({ user: req.userId })`, `placeOrder(req.userId, …)`. The client never sends a user id. Tests assert the queries are scoped.

**Why httpOnly cookies instead of localStorage?**
JavaScript can't read httpOnly cookies, so XSS can't steal the token. The trade-off is CSRF, which SameSite=Lax mitigates because the browser won't attach the cookie to cross-site POSTs.

**How does the dashboard know who's logged in if it can't read the cookie?**
It calls `GET /auth/me` on load. The browser sends the cookie; the server verifies it and returns the user.

**What happens when the token expires?**
`jwt.verify` throws, `requireAuth` returns `401`, the axios interceptor sets `user` to null, and `withAuth` redirects to `/login`.

**How does logout work, and what's its weakness?**
It clears the cookie. The JWT itself stays valid until expiry — if someone copied it, they could still use it. Fixing that needs server-side state: a denylist or refresh tokens stored in the DB.

**Explain the average cost calculation.**
Quantity-weighted mean: `(oldAvg × oldQty + price × newQty) / (oldQty + newQty)`. Two shares at 100 plus two at 200 → four at 150. Selling doesn't change average cost, only quantity.

**What happens if I try to sell more than I own?**
The conditional update (available shares `qty − reservedQty ≥ 5`, via `$expr`) matches nothing, so the service throws `ApiError(400, "Cannot sell 5 ITC — you have 1 available.")` — adding how many more are reserved for open sell orders, if any. No cash is credited and no order is logged, because both happen only after the decrement succeeds.

**What stops a user buying at a fake price?**
The order body has no price. The server looks up the symbol in the `stocks` collection and fills at that price; if a client sends `price`, zod strips it. A test sends `price: 1` and asserts the fill is at the market price.

**What if two buy requests arrive at the same moment with only enough cash for one?**
The debit is `findOneAndUpdate({ _id, cash: { $gte: cost } }, { $inc: { cash: -cost } })`. MongoDB applies single-document updates atomically, so the first one matches and the second finds the balance too low and gets `400`. A read-then-write ("load user, check cash, save") would let both through.

**What happens if the debit succeeds but saving the holding fails?**
Both happen inside one transaction, so the failure aborts it and the debit is rolled back. An integration test forces `Order.create` to fail after the debit and checks cash and holdings are unchanged.

**Walk me through a limit buy.**
Placing it: zod checks `limitPrice`. If the market is already at or below the limit, it fills now at the market price. Otherwise, in one transaction, `qty × limit` moves from `cash` to `reservedCash` (conditional on `cash >= reserve`) and a `PENDING` order is created. On each price tick, the matcher finds pending orders the new price satisfies and calls `settleOrder`: in one transaction it claims the order `PENDING → FILLED`, spends the reserve, refunds the unused part, and adds the shares at the fill price.

**Why reserve funds when the order is placed, not when it fills?**
Otherwise you can over-commit — ten ₹1 lakh orders against one ₹1 lakh balance — and only discover it at fill time. Brokers block funds at placement for the same reason. Reserving at the limit price is the worst case, so a fill never needs more.

**How do you stop an order filling twice?**
The fill starts with `findOneAndUpdate({ _id, status: "PENDING", …priceCondition }, { status: "FILLED" })`. A single-document update is atomic, so only one caller can match; the other gets `null` and does nothing. An integration test calls `settleOrder` twice concurrently and checks the cash moved once.

**What if the user cancels at the exact moment it fills?**
Cancel uses the same claim (`status: "PENDING"` → `CANCELLED`). Whichever transaction commits first wins; the other's claim matches nothing. If the fill wins, the cancel returns `409 "already filled"` and the UI refetches. Tested against a real replica set.

**Why does a buy limit of ₹200 fill at ₹185?**
The limit is the worst price you accept, not the price you want. Filling at the better market price is how exchanges behave; the ₹15 × qty difference from the reserve goes back to cash.

**What happens to pending orders when the server restarts?**
They're day orders: at startup `expirePendingOrders` moves each to `EXPIRED` in its own transaction and releases its reserve.

**Why do transactions need a replica set?**
MongoDB implements them on top of the replication log (oplog), which a standalone server doesn't have. Atlas is always a replica set; locally I run a single-node one. The server checks at startup and refuses to run standalone.

**Doesn't a transaction make the conditional updates redundant?**
No. A transaction guarantees all-or-nothing; it doesn't stop two transactions both reading "cash = ₹1000" and both deciding they can spend ₹800. The conditional update makes the check and the change one atomic step on the document, so the second one fails the condition (or hits a write conflict and retries, then fails it).

**How do prices stay the same for everyone?**
There's one `Stock` document per symbol. The simulator moves those, then copies each price onto every holding and position with that symbol.

**Why split app.js and server.js?**
So tests can import the app and send it requests with supertest without connecting to MongoDB, opening a port, or starting the simulator.

**What does asyncHandler do and why is it needed?**
Express 4 doesn't catch rejected promises from async handlers; the request would hang. `asyncHandler` catches the rejection and calls `next(err)`, so the error handler responds.

**How is "real-time" implemented?**
A server-side loop changes prices every 4 seconds (each tick scheduled with `setTimeout` after the previous one finishes, then the limit-order matcher runs); the dashboard polls every 5 seconds and flashes rows whose price changed. It's polling, not push.

**How would you make it truly real-time?**
Socket.IO: the server emits price updates per symbol to subscribed clients after each tick; the client updates state on each event. Authenticate the socket handshake with the same cookie.

**Why is CORS configured with a list of origins?**
With credentials, browsers reject `Access-Control-Allow-Origin: *`. A whitelist also stops other websites' JavaScript from reading API responses with the user's cookie.

**How is it deployed?**
API on Render (`render.yaml`: builds `backend/`, generates `JWT_SECRET`, health-checks `/health`), both React apps on Vercel, MongoDB on Atlas. The dashboard calls `/api` on its own domain and `dashboard/vercel.json` rewrites it to Render. That makes the auth cookie first-party, so `SameSite=Lax` works and browsers that block third-party cookies don't log users out. In production the cookie is also `Secure`.

**Why proxy instead of calling Render directly?**
Calling `onrender.com` from `vercel.app` is cross-site. The cookie would need `SameSite=None; Secure`, which reopens CSRF (you'd add CSRF tokens) and gets blocked by browsers that drop third-party cookies. The proxy avoids all of that. The trade-off is an extra hop through Vercel.

**What happens on Render's free plan?**
The service sleeps after inactivity, so the first request takes ~30s, and the price simulator only runs while it's awake.

**Why MongoDB for a trading app?**
Honest answer: it was quick to model and iterate on. For real money I'd prefer PostgreSQL — ACID transactions across holdings and orders, numeric types instead of floats, constraints like `qty >= 0`.

**What's the biggest weakness?**
Matching runs inside the API process, so it doesn't scale out cleanly — several instances would all run it (correctly, thanks to the status claim, but wastefully). I'd move it to a single worker fed by price events. And balances are mutable fields; an append-only ledger you derive balances from would give a full audit trail.

**How did you test it?**
Two layers. 63 unit tests with mocked models check every route, validation rule, and trading path — including the exact conditional updates and that each write carries the transaction's session. 11 integration tests run against a real replica set and fire concurrent requests: double spends, double fills, and cancel-vs-fill races, plus a forced failure to prove rollback. Plus manual end-to-end checks against a real database.

**Why are prices stored as strings like "+0.58%"?**
`net` and `day` are display strings carried over from the original UI. Better: store numbers and format in the frontend.

**What did you refactor, and why?**
The backend started as one `index.js` with inline routes and no error handling. I split it into `app.js`/`server.js` and route/controller/service/model layers, added zod validation, `ApiError` + a central error handler, and tests. I also moved the API to versioned REST paths (`/api/v1/holdings` instead of `/allHoldings`), fixed the trading model (server-side fill prices, a cash balance with atomic debits, one shared price table), and added limit orders with reserved funds, a matcher, and transactions.

---

## 13. General technical questions

**What is middleware in Express?**
A function `(req, res, next)` in the request pipeline. It can modify `req`/`res`, end the response, or call `next()`. Error middleware has four arguments `(err, req, res, next)`.

**Authentication vs authorization?**
Authentication: who are you (login, `requireAuth`). Authorization: what may you do (only your own holdings — the `user` filter).

**What's in a JWT and is it encrypted?**
Header, payload, signature. It's signed, not encrypted — anyone can decode the payload. The signature only proves integrity.

**Stateless vs stateful sessions?**
Stateless (JWT): the token carries everything; no DB lookup to verify, but hard to revoke. Stateful (session id + store): easy to revoke, but every request hits the store.

**What is XSS? CSRF?**
XSS: attacker's script runs in your page (can read localStorage, make requests as you). CSRF: another site makes your browser send an authenticated request to your API. httpOnly protects tokens from XSS; SameSite and CSRF tokens prevent CSRF.

**Why is bcrypt slow on purpose?**
To make brute-forcing stolen hashes expensive. The cost factor can be raised as hardware gets faster.

**What is CORS preflight?**
For non-simple requests (e.g. `Content-Type: application/json`), the browser sends `OPTIONS` first to ask if the real request is allowed.

**REST principles?**
Resources as nouns (`/orders`), HTTP verbs for actions (`GET` list, `POST` create), proper status codes (`201` created, `400`, `401`, `404`, `409`), stateless requests, versioning (`/api/v1`).

**What does `useEffect` cleanup do?**
Runs before the effect re-runs and on unmount — used to clear intervals (`usePolling`) and timeouts (`usePriceFlash`) so they don't leak.

**Why store the callback in a ref in `usePolling`?**
So the interval always calls the latest callback without being torn down and recreated every render.

**What is React Context for?**
Sharing state (current user, order window) across the tree without prop drilling.

**What is a higher-order component?**
A function that takes a component and returns a new one with extra behavior — `withAuth(Home)` adds the login check.

**Mongoose index — why on `user`?**
Every query filters by user; without an index MongoDB scans the whole collection.

**What is a write conflict, and what happens on one?**
Two transactions modifying the same document. MongoDB aborts one with a transient error; the driver's `withTransaction` retries it from the start, and the retry re-reads current state — which is why all reads happen inside the callback.

**How do you avoid race conditions when updating a balance or quantity?**
Atomic operators (`$inc` with a condition like `{ qty: { $gte: n } }`) or transactions, instead of read-modify-write in application code.

**What's the difference between 401 and 403?**
401: not authenticated (no or invalid credentials). 403: authenticated but not allowed.

**Why `201` for order creation?**
It signals a new resource was created; the response includes it.

---

## 14. Rapid-fire facts

- Ports: frontend **5173**, dashboard **5174**, API **3002**.
- Cookie: name `token`, **httpOnly**, **SameSite=Lax**, `secure` in production, **7 days**.
- JWT payload: `{ sub: userId }`, signed with `JWT_SECRET`, expires in **7d**.
- bcrypt cost: **10**.
- Password minimum: **8** characters.
- Body limit: **40kb**.
- Simulator: every **4s**, moves **0.05–0.4%**.
- Dashboard polling: every **5s**; row flash lasts **900ms**.
- Starter portfolio: **13 holdings, 2 positions**.
- Tests: **63 unit** (12 auth, 27 API, 24 trading; no DB) + **11 integration** (real replica set).
- Order statuses: **PENDING → FILLED / CANCELLED / EXPIRED**. Limit orders are day orders.
- Reserve: buy **qty × limit** (cash → `reservedCash`); sell **qty** shares (`reservedQty`). Fills at the **market** price; unused reserve refunded.
- Starting cash: **₹1,00,000**. Market: **18 symbols**. Orders fill at the server's price.
- MongoDB must be a **replica set** (transactions); local single node `rs0`, or Atlas.
- Demo login: `demo@vertextrade.dev` / `demo1234` (created by `npm run seed`, which wipes the DB).
- API base: `/api/v1`; health check at `/health`.
- One command: `npm run dev` at the root starts all three apps.
- Deploy: API on **Render** (`render.yaml`), apps on **Vercel** (`vercel.json`), DB on **Atlas**; `/api` proxied so the cookie is first-party.
