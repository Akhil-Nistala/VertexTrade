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
> VertexTrade is a full-stack stock trading platform. It has three apps: a React marketing site, a React trading dashboard, and an Express + MongoDB API. Users sign up with ₹1,00,000 of virtual cash and place market orders that the server fills at live simulated prices. Auth is bcrypt plus a JWT in an httpOnly cookie, and every query is scoped to the logged-in user. The API is tested with Jest and supertest.

**What to emphasise (pick two or three):**
- **Per-user data isolation** — the user id always comes from the verified token, never from the request body, so one user can't read or trade another's portfolio.
- **Real business logic** — the server picks the fill price (never the client), buys check the cash balance, buys average into the cost basis, sells are rejected if they exceed what you hold, and a rejected order is never logged.
- **Race-safe money updates** — cash is debited and shares are removed with single conditional atomic updates, so simultaneous orders can't overspend or oversell.
- **Secure-by-default auth** — httpOnly + SameSite cookie, no user enumeration (same message *and* similar timing for wrong email vs wrong password).
- **Testable backend** — `app.js` / `server.js` split, so 39 HTTP tests run without a database.

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
```

- **Three independently runnable apps.** The marketing site never talks to the API; it just links to the dashboard.
- **The dashboard and API are on different ports (origins)** but the same *site* (`localhost`), which is why a `SameSite=Lax` cookie works with `withCredentials: true` and a CORS whitelist.
- **One market for everyone:** the `stocks` collection holds one price per symbol; the simulator moves it and copies it onto every holding and position.
- **"Real-time" is polling**, not WebSockets: the server mutates prices every 4s, the dashboard re-fetches every 5s.

---

## 3. Tech stack and why

| Choice | Why | Alternative you can mention |
|---|---|---|
| **React + Vite** | Fast dev server, simple build, standard | Next.js (SSR not needed for an authenticated dashboard) |
| **MUI + Chart.js** (dashboard) | Icons/tooltips and charts without building from scratch | Recharts |
| **Bootstrap** (marketing) | Static pages, quick responsive layout | Tailwind |
| **Express** | Minimal, well known, middleware model fits auth/validation | Fastify, NestJS |
| **MongoDB + Mongoose** | Flexible documents, schemas + validation in Mongoose | PostgreSQL — arguably better for money (transactions, constraints) |
| **bcryptjs** | Slow, salted password hashing; pure JS so no native build | argon2 |
| **jsonwebtoken** | Stateless sessions, no session store needed | express-session + Redis |
| **zod** | Declarative request validation with typed, normalized output | Joi, express-validator |
| **Jest + supertest** | Send real HTTP requests to the app in-process | Vitest |
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
│   │   ├── server.js         # entry: check env, connect DB, listen, start simulator
│   │   ├── seed.js           # wipe DB, create demo user + starter portfolio
│   │   ├── config/db.js
│   │   ├── routes/           # auth, holding, position, order, stock, funds
│   │   ├── controllers/      # auth, holding, position, order, stock, funds
│   │   ├── middleware/       # auth (requireAuth), validate (zod), errorHandler
│   │   ├── validators/       # auth, order (zod schemas)
│   │   ├── models/           # user, stock, holding, position, order
│   │   ├── services/         # trading.service (fills, cash, cost basis), priceSimulator
│   │   ├── utils/            # ApiError, asyncHandler, tokens, formatPercent, money
│   │   └── data/             # market.js (stock universe, openMarket), samplePortfolio.js
│   └── tests/                # auth.test.js, order.test.js, setup.js
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

**The layering rule:** route → middleware (auth, validation) → controller → service/model. Controllers stay thin; business rules (market fills, cash check, cost basis, oversell check) live in the trading service.

---

## 5. Backend, file by file

### Entry points
- **`src/app.js`** — creates the Express app; registers CORS (origin whitelist from `CLIENT_ORIGINS`, `credentials: true`), `cookie-parser`, `express.json` and `express.urlencoded` (40kb limits), `GET /health`, the four routers under `/api/v1/...`, then the 404 handler and error handler. **Exports the app without listening** — that's what makes it testable.
- **`src/server.js`** — fails fast if `JWT_SECRET` is missing, connects MongoDB via `connectDB(MONGO_URL)`, runs `openMarket()`, calls `app.listen`, then `startPriceSimulator()`. Any startup error → log and `process.exit(1)`.
- **`src/seed.js`** — connects, deletes all users/holdings/positions/orders/stocks, re-opens the market, creates `demo@vertextrade.dev / demo1234` with a bcrypt hash, gives it the starter portfolio, disconnects.

### Routes (thin — just wiring)
- **`auth.routes.js`** — `POST /signup` (validate → signup), `POST /login` (validate → login), `POST /logout`, `GET /me` (requireAuth → me).
- **`holding.routes.js` / `position.routes.js`** — `router.use(requireAuth)` then `GET /`.
- **`order.routes.js`** — `router.use(requireAuth)`; `GET /` lists, `POST /` validates with `newOrderSchema` then places.
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
  - `getOrders` — `Order.find({user}).sort({_id: -1})` (ObjectIds embed creation time, so `_id` desc ≈ newest first).
  - `placeOrder` — hands `req.body` (`{ name, qty, mode }`) to the trading service; `201 { success, order, cash }`.
- **`stock.controller.js`** — `Stock.find().sort({symbol: 1})`, returns `{ symbol, price, day, isDown }` with day change computed from `open`.
- **`funds.controller.js`** — `User.findById(req.userId, { cash: 1 })` → `{ cash }` rounded to paise.

### Services
- **`trading.service.js` → `placeOrder(userId, { name, qty, mode })`**
  1. `Stock.findOne({ symbol: name })` → `400 "Unknown instrument"` if missing. **The fill price is `stock.price`** — the client never sends one (zod strips it if it does).
  2. `amount = round(price × qty)`.
  3. **BUY:** `User.findOneAndUpdate({ _id, cash: { $gte: amount } }, { $inc: { cash: -amount } })` — one atomic check-and-debit. No match → `400 "Insufficient funds…"`. Then `addToHolding` (create at the fill price, or average in: `newAvg = (avg·qty + price·newQty) / (qty + newQty)`). If that throws, **refund** the debit and rethrow.
  4. **SELL:** `Holding.findOneAndUpdate({ user, name, qty: { $gte: qty } }, { $inc: { qty: -qty } })` — atomic check-and-decrement. No match → `400 "Cannot sell X — you only hold Y."`. Quantity reaches 0 → delete the holding. Then credit `amount` to cash. **Avg cost doesn't change on a sell.**
  5. Only then `Order.create(...)` — so rejected orders are never logged. Returns `{ order, cash }`.
- **`priceSimulator.js`** — `setInterval` every 4s: move each **stock** by ±0.05–0.4% (`bulkWrite`), then copy the new price onto every holding and position (`bulkWrite`): `price`, `day` (vs the stock's `open`), `net` (vs the holder's `avg`), `isLoss`. Errors swallowed — a missed tick is harmless.

### Models
- **`user.model.js`** — `name`, `email` (unique, lowercase, trimmed), `passwordHash`, `cash` (default ₹1,00,000, min 0), timestamps.
- **`stock.model.js`** — `symbol` (unique), `price`, `open`. The single source of truth for prices.
- **`holding.model.js`** — `user` (ObjectId ref, required, **indexed**), `name, qty, avg, price, net, day, isLoss`.
- **`position.model.js`** — same plus `product`, `isLoss`.
- **`order.model.js`** — `user`, `name, qty, price`, `mode` (enum BUY/SELL), timestamps.

### Validators (zod)
- **`auth.validator.js`** — signup: non-empty trimmed name, valid email (trimmed + lowercased), password ≥ 8. Login: email + password strings.
- **`order.validator.js`** — name non-empty after trim, `qty` integer > 0, `mode` ∈ {BUY, SELL}. **No price field** — unknown keys are stripped. **`z.number()` rejects `"5"`** — strings aren't coerced.

### Utils
- **`ApiError`** — `Error` + `statusCode` + optional `details`.
- **`asyncHandler(fn)`** — wraps async handlers, forwards rejections to `next(err)`. Without it, Express 4 never responds to a thrown async error and the request hangs.
- **`tokens.js`** — `signSessionToken` (`{ sub: userId }`, 7d), `verifySessionToken`, `setSessionCookie` (httpOnly, 7-day maxAge, `secure` in production, `sameSite` from `COOKIE_SAMESITE` or `lax` in dev / `none` in production), `clearSessionCookie`.
- **`money.js`** — `roundMoney` (to paise) and `percentChange`.
- **`data/market.js`** — the 18-symbol universe. `openMarket()` upserts missing stocks (`$setOnInsert`, so existing prices are kept), sets every `open` to the current price (a new "trading day" per server start), and backfills `cash` for accounts created before balances existed.
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
- **`components/OrderActionWindow.jsx`** — qty input only. Shows the live market price (polls `/stocks`), approximate cost/proceeds, and available cash (`useFunds`). Posts `{ name, qty, mode }`; shows the server error (insufficient funds, oversell) inline.
- **`pages/Holdings.jsx`, `Positions.jsx`, `Orders.jsx`, `Summary.jsx`** — fetch with `usePolling(fn, 5000)`; Holdings/Positions use `usePriceFlash` to flash rows. Summary shows real cash, invested amount, account value, and P&L; greets the user by first name.
- **`hooks/usePolling.js`** — runs the callback immediately, then on an interval; stores the callback in a ref so the interval isn't re-created when the callback changes.
- **`hooks/usePriceFlash.js`** — remembers previous prices in a ref; returns `{ id: "tick-up" | "tick-down" }` for changed rows, cleared after 900ms.
- **`hooks/useFunds.js`** — polls `GET /funds`, returns `cash`; also exports `formatRupees` (Indian digit grouping).
- **`pages/Funds.jsx`** — available cash, invested, holdings value, account value, starting balance — all real.
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

### Placing an order
1. Hover a watchlist row → Buy/Sell → `GeneralContext.openOrderWindow(symbol, mode)`.
2. The window shows the live price and available cash. Enter qty → `POST /api/v1/orders { name, qty, mode }`.
3. `requireAuth` → `req.userId`. `validate(newOrderSchema)` → `400` if bad.
4. Server looks up the stock; fill price = current market price.
5. BUY → atomic debit if cash ≥ cost (else `400`), then create/average the holding (refund on failure). SELL → atomic decrement if qty held ≥ sold (else `400`), delete at zero, credit proceeds.
6. `Order.create` → `201 { order, cash }`. Window closes; next poll shows the new holding, order, and balance.

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

- **Setup:** `tests/setup.js` sets `JWT_SECRET` and `CLIENT_ORIGINS`. Jest runs ES modules via `--experimental-vm-modules`.
- **Approach:** `jest.unstable_mockModule` replaces the Mongoose models, then the tests `import app` and use **supertest** to send real HTTP requests in-process. No database, no open port.
- **`auth.test.js` (12 tests):** production cookies are `Secure` and default to `SameSite=None`, or `Lax` with `COOKIE_SAMESITE=lax`; signup normalizes input, stores only a hash, gives the starter portfolio, sets an httpOnly + SameSite=Lax cookie; duplicate email `409`; short password and bad email `400`; login success; wrong password and unknown email return the **same** `401`; `/me` without cookie `401`, with valid token `200`, tampered token `401`; logout clears the cookie.
- **`order.test.js` (27 tests):** all six data routes `401` without a session; holdings/positions/orders/funds are queried for `USER_ID` only; `/stocks` computes day change from open; BUY **fills at the market price even when the client sends price 1**; BUY debits with the exact conditional update `{ cash: { $gte: 600 } }`; insufficient funds `400` with **no holding or order**; averaging (2 @ 100 + 2 @ 200 → 4 @ 150); **refund when the holding save fails**; SELL uses the conditional decrement and credits proceeds; full sell deletes the holding; oversell `400` with **no credit and no order**; unknown symbol `400`; five invalid bodies `400`; `/health`; JSON 404.
- **What they don't cover:** real MongoDB behavior (unique index, queries). Next step: `mongodb-memory-server` integration tests and frontend tests.

---

## 10. Design decisions (and how to defend them)

**Single JWT cookie instead of access + refresh tokens.** Simpler, no token store, and the httpOnly cookie removes the main reason for short-lived access tokens (XSS theft). Cost: can't revoke a token before it expires — logout only clears the cookie in that browser. Next step: refresh-token rotation or a server-side denylist.

**User id from the token, never the request.** The single most important rule for multi-user data. Every query includes `user: req.userId`.

**The server sets the price.** Orders carry only symbol, qty, and side; the fill price comes from the `stocks` collection. Originally the client sent the price — a user could have bought at ₹1. Fixing that is a good story: "never trust the client with anything that decides money".

**Conditional atomic updates instead of read-then-write.** `findOneAndUpdate({ cash: { $gte: cost } }, { $inc: … })` checks and changes in one operation on one document, so two concurrent buys can't both pass the check. Same for sells with `qty: { $gte: n }`. Because cash and holdings are separate documents, the service refunds the debit if the second step fails (a compensating action) instead of using a transaction, which would require a replica set.

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

- **No multi-document transaction.** Cash and holding updates are each atomic, with a refund if the second fails, but a crash between the two steps could still leave them inconsistent. Fix: a MongoDB transaction (needs a replica set) or a ledger.
- **Buy averaging is read-then-write.** Two simultaneous buys of the same symbol could both read the old holding; cash is safe, but the average cost could be slightly off. Fix: a pipeline update, or a unique `{ user, name }` index plus retry.
- **Money as floats.** Rupee floats rounded to paise; integer paise would avoid drift entirely.
- **Simulator rewrites every holding every 4s.** It uses `bulkWrite`, but it's still O(all holdings). At scale, holdings would reference the stock and price would be joined at read time instead of copied.
- **Simulated market.** Random-walk prices, market orders only — no limit orders, margin, or adding/withdrawing funds. The "day" opens when the server starts.
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
The conditional update `{ qty: { $gte: 5 } }` matches nothing, so the service throws `ApiError(400, "Cannot sell 5 ITC — you only hold 1.")`. No cash is credited and no order is logged, because both happen only after the decrement succeeds.

**What stops a user buying at a fake price?**
The order body has no price. The server looks up the symbol in the `stocks` collection and fills at that price; if a client sends `price`, zod strips it. A test sends `price: 1` and asserts the fill is at the market price.

**What if two buy requests arrive at the same moment with only enough cash for one?**
The debit is `findOneAndUpdate({ _id, cash: { $gte: cost } }, { $inc: { cash: -cost } })`. MongoDB applies single-document updates atomically, so the first one matches and the second finds the balance too low and gets `400`. A read-then-write ("load user, check cash, save") would let both through.

**What happens if the debit succeeds but saving the holding fails?**
The service catches the error, refunds the cash with `$inc: { cash: +cost }`, and rethrows (`500`). It's a compensating action; a transaction would be cleaner but needs a replica set.

**How do prices stay the same for everyone?**
There's one `Stock` document per symbol. The simulator moves those, then copies each price onto every holding and position with that symbol.

**Why split app.js and server.js?**
So tests can import the app and send it requests with supertest without connecting to MongoDB, opening a port, or starting the simulator.

**What does asyncHandler do and why is it needed?**
Express 4 doesn't catch rejected promises from async handlers; the request would hang. `asyncHandler` catches the rejection and calls `next(err)`, so the error handler responds.

**How is "real-time" implemented?**
A server-side `setInterval` changes prices every 4 seconds; the dashboard polls every 5 seconds and flashes rows whose price changed. It's polling, not push.

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
Cash and holdings are updated in two separate atomic steps with a compensating refund, not one transaction. I'd move to a replica set and wrap the debit, holding update, and order insert in a transaction — or keep an append-only ledger and derive balances from it.

**How did you test it?**
39 Jest + supertest tests with mocked models: auth flows, cookie flags (including production settings), the auth guard on every route, per-user query scoping, market-price fills, the exact atomic update conditions, insufficient funds, the refund path, buy/sell rules, and validation. Plus manual end-to-end checks against a real database.

**Why are prices stored as strings like "+0.58%"?**
`net` and `day` are display strings carried over from the original UI. Better: store numbers and format in the frontend.

**What did you refactor, and why?**
The backend started as one `index.js` with inline routes and no error handling. I split it into `app.js`/`server.js` and route/controller/service/model layers, added zod validation, `ApiError` + a central error handler, and tests. I also moved the API to versioned REST paths (`/api/v1/holdings` instead of `/allHoldings`), and fixed the trading model: server-side fill prices, a cash balance with atomic debits, and one shared price table.

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
- Tests: **39** (12 auth, 27 trading/data), no DB needed.
- Starting cash: **₹1,00,000**. Market: **18 symbols**. Orders fill at the server's price.
- Demo login: `demo@vertextrade.dev` / `demo1234` (created by `npm run seed`, which wipes the DB).
- API base: `/api/v1`; health check at `/health`.
- One command: `npm run dev` at the root starts all three apps.
- Deploy: API on **Render** (`render.yaml`), apps on **Vercel** (`vercel.json`), DB on **Atlas**; `/api` proxied so the cookie is first-party.
