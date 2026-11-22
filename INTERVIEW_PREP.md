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
> VertexTrade is a full-stack stock trading platform. It has three apps: a React marketing site, a React trading dashboard, and an Express + MongoDB API. Users sign up, get a starter portfolio, and buy and sell stocks while a background simulator moves prices. Auth is bcrypt plus a JWT in an httpOnly cookie, and every query is scoped to the logged-in user. The API is tested with Jest and supertest.

**What to emphasise (pick two or three):**
- **Per-user data isolation** — the user id always comes from the verified token, never from the request body, so one user can't read or trade another's portfolio.
- **Real business logic** — buys average into the cost basis (quantity-weighted), sells are rejected if they exceed what you hold, and a rejected order is never logged.
- **Secure-by-default auth** — httpOnly + SameSite cookie, no user enumeration (same message *and* similar timing for wrong email vs wrong password).
- **Testable backend** — `app.js` / `server.js` split, so 28 HTTP tests run without a database.

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
     │                          │                                  │ price simulator ──────▶ │ holdings,
     │                          │                                  │ every 4s                │ positions
```

- **Three independently runnable apps.** The marketing site never talks to the API; it just links to the dashboard.
- **The dashboard and API are on different ports (origins)** but the same *site* (`localhost`), which is why a `SameSite=Lax` cookie works with `withCredentials: true` and a CORS whitelist.
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
├── backend/
│   ├── src/
│   │   ├── app.js            # builds the Express app (no DB, no listen)
│   │   ├── server.js         # entry: check env, connect DB, listen, start simulator
│   │   ├── seed.js           # wipe DB, create demo user + starter portfolio
│   │   ├── config/db.js
│   │   ├── routes/           # auth, holding, position, order
│   │   ├── controllers/      # auth, holding, position, order
│   │   ├── middleware/       # auth (requireAuth), validate (zod), errorHandler
│   │   ├── validators/       # auth, order (zod schemas)
│   │   ├── models/           # user, holding, position, order
│   │   ├── services/         # holdings.service (buy/sell), priceSimulator
│   │   ├── utils/            # ApiError, asyncHandler, tokens, formatPercent
│   │   └── data/samplePortfolio.js
│   └── tests/                # auth.test.js, order.test.js, setup.js
├── dashboard/src/
│   ├── App.jsx               # /login, /signup, /* → withAuth(Home)
│   ├── pages/                # Authentication, Home, Summary, Orders, Holdings, Positions, Funds, Apps
│   ├── components/           # TopBar, Menu, WatchList, OrderActionWindow, Dashboard, charts, Logo
│   ├── context/              # AuthContext, GeneralContext
│   ├── config/api.js         # axios instance
│   ├── utils/withAuth.jsx    # route guard (HOC)
│   ├── hooks/                # usePolling, usePriceFlash
│   ├── styles/
│   └── data/data.js          # watchlist (static sample data)
└── frontend/src/
    ├── App.jsx
    ├── pages/                # Home, Products, Pricing, About, Support, Signup, NotFound
    └── components/           # Navbar, Footer, Logo, OpenAccount + per-page sections
```

**The layering rule:** route → middleware (auth, validation) → controller → service/model. Controllers stay thin; business rules (cost basis, oversell check) live in the service.

---

## 5. Backend, file by file

### Entry points
- **`src/app.js`** — creates the Express app; registers CORS (origin whitelist from `CLIENT_ORIGINS`, `credentials: true`), `cookie-parser`, `express.json` and `express.urlencoded` (40kb limits), `GET /health`, the four routers under `/api/v1/...`, then the 404 handler and error handler. **Exports the app without listening** — that's what makes it testable.
- **`src/server.js`** — fails fast if `JWT_SECRET` is missing, connects MongoDB via `connectDB(MONGO_URL)`, calls `app.listen`, then `startPriceSimulator()`. Any startup error → log and `process.exit(1)`.
- **`src/seed.js`** — connects, deletes all users/holdings/positions/orders, creates `demo@vertextrade.dev / demo1234` with a bcrypt hash, gives it the starter portfolio, disconnects.

### Routes (thin — just wiring)
- **`auth.routes.js`** — `POST /signup` (validate → signup), `POST /login` (validate → login), `POST /logout`, `GET /me` (requireAuth → me).
- **`holding.routes.js` / `position.routes.js`** — `router.use(requireAuth)` then `GET /`.
- **`order.routes.js`** — `router.use(requireAuth)`; `GET /` lists, `POST /` validates with `newOrderSchema` then places.

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
  - `placeOrder` — BUY → `applyBuy`, SELL → `applySell` (throws `ApiError(400)` on oversell), **then** `Order.create(...)`, `201 { success, order }`. Holding first, order second, so a rejected sell is never logged.

### Services
- **`holdings.service.js`**
  - `applyBuy(userId, name, qty, price)` — no holding → create with `avg = price`. Existing → `newAvg = (avg·qty + price·newQty) / (qty + newQty)`, update `net`.
  - `applySell(userId, name, qty)` — no holding or `qty > held` → `400 "Cannot sell X — you only hold Y."`; selling everything deletes the holding; otherwise decrement. **Avg cost doesn't change on a sell** — that's how cost basis works.
- **`priceSimulator.js`** — `setInterval` every 4s: for every holding and position, move price by ±0.05–0.4%, set `day` to the move, recompute `net` vs `avg`. Errors swallowed — it's cosmetic.

### Models
- **`user.model.js`** — `name`, `email` (unique, lowercase, trimmed), `passwordHash`, timestamps.
- **`holding.model.js`** — `user` (ObjectId ref, required, **indexed**), `name, qty, avg, price, net, day`.
- **`position.model.js`** — same plus `product`, `isLoss`.
- **`order.model.js`** — `user`, `name, qty, price`, `mode` (enum BUY/SELL), timestamps.

### Validators (zod)
- **`auth.validator.js`** — signup: non-empty trimmed name, valid email (trimmed + lowercased), password ≥ 8. Login: email + password strings.
- **`order.validator.js`** — name non-empty after trim, `qty` integer > 0, `price` finite > 0, `mode` ∈ {BUY, SELL}. **`z.number()` rejects `"5"`** — strings aren't coerced.

### Utils
- **`ApiError`** — `Error` + `statusCode` + optional `details`.
- **`asyncHandler(fn)`** — wraps async handlers, forwards rejections to `next(err)`. Without it, Express 4 never responds to a thrown async error and the request hangs.
- **`tokens.js`** — `signSessionToken` (`{ sub: userId }`, 7d), `verifySessionToken`, `setSessionCookie` (httpOnly, SameSite=Lax, `secure` in production, 7-day maxAge), `clearSessionCookie`.
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
- **`components/WatchList.jsx`** — static sample list from `data/data.js`, search filter (`useMemo`), hover actions open the order window, doughnut chart.
- **`context/GeneralContext.jsx`** — tracks whether the order window is open, for which symbol, BUY or SELL.
- **`components/OrderActionWindow.jsx`** — qty/price inputs, client-side validation, `POST /orders`, shows the server error (e.g. oversell) inline.
- **`pages/Holdings.jsx`, `Positions.jsx`, `Orders.jsx`, `Summary.jsx`** — fetch with `usePolling(fn, 5000)`; Holdings/Positions use `usePriceFlash` to flash rows. Summary computes investment, current value, P&L from holdings; greets the user by first name.
- **`hooks/usePolling.js`** — runs the callback immediately, then on an interval; stores the callback in a ref so the interval isn't re-created when the callback changes.
- **`hooks/usePriceFlash.js`** — remembers previous prices in a ref; returns `{ id: "tick-up" | "tick-down" }` for changed rows, cleared after 900ms.
- **`pages/Funds.jsx`, `Apps.jsx`** — illustrative static content.

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
2. Enter qty/price → `POST /api/v1/orders`.
3. `requireAuth` → `req.userId`. `validate(newOrderSchema)` → `400` if bad.
4. BUY → `applyBuy` (create or average in). SELL → `applySell` (`400` if oversell; delete if fully sold).
5. `Order.create` → `201`. Window closes; next poll shows the new holding and order.

### Live prices
- Server: every 4s, the simulator updates every holding/position document.
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
- **`auth.test.js` (10 tests):** signup normalizes input, stores only a hash, gives the starter portfolio, sets an httpOnly + SameSite=Lax cookie; duplicate email `409`; short password and bad email `400`; login success; wrong password and unknown email return the **same** `401`; `/me` without cookie `401`, with valid token `200`, tampered token `401`; logout clears the cookie.
- **`order.test.js` (18 tests):** every data route `401` without a session; holdings/positions/orders are queried with `{ user: USER_ID }`; BUY creates a holding and logs the order; BUY averages cost (2 @ 100 + 2 @ 200 → 4 @ 150); oversell `400` and **no order logged**; full sell deletes the holding; five invalid order bodies `400`; `/health`; JSON 404.
- **What they don't cover:** real MongoDB behavior (unique index, queries). Next step: `mongodb-memory-server` integration tests and frontend tests.

---

## 10. Design decisions (and how to defend them)

**Single JWT cookie instead of access + refresh tokens.** Simpler, no token store, and the httpOnly cookie removes the main reason for short-lived access tokens (XSS theft). Cost: can't revoke a token before it expires — logout only clears the cookie in that browser. Next step: refresh-token rotation or a server-side denylist.

**User id from the token, never the request.** The single most important rule for multi-user data. Every query includes `user: req.userId`.

**Holding update before order log.** A rejected sell throws before `Order.create`, so the order history only contains accepted orders.

**`app.js` / `server.js` split.** Tests import the app without a database or port; the server file is the only place with side effects.

**Central error handler + `asyncHandler`.** One response shape; unknown errors never leak stack traces; async errors can't hang requests.

**Validation with zod in middleware.** Controllers receive clean, normalized data and don't repeat checks.

**Polling instead of WebSockets.** Simple, works through any proxy, fine at 5s granularity for a demo. WebSockets (Socket.IO) would push updates instantly and cut wasted requests.

**Two frontend apps.** Marketing is static and public; trading is authenticated and data-heavy. Separate deploys, separate concerns.

**Starter portfolio on signup.** A new user sees a working dashboard immediately instead of an empty page.

**`user` field indexed.** Every query filters by user, so the index keeps reads fast as data grows.

---

## 11. Known limitations (say these before they ask)

- **Client chooses the fill price.** The order's `price` comes from the form, so a user can "buy" at any price. A real system fills at the current market price on the server.
- **No funds or margin check.** Buys aren't limited by a balance; the Funds page is illustrative.
- **Prices are per user.** The simulator moves each user's copy of a stock independently, so two users holding INFY see different prices. Fix: a shared `prices` collection that holdings reference.
- **Simulator scans every document every 4s** (`find({})` then one `updateOne` each). Fine for a demo; at scale you'd update one price per symbol, or use `bulkWrite`.
- **No transactions.** `applyBuy`/`applySell` read-modify-write the holding; two simultaneous orders on the same symbol could race. Fix: atomic `$inc` updates or a MongoDB transaction around holding + order.
- **Watchlist is static** sample data in the frontend.
- **Holdings' day-change colour doesn't update** — the simulator sets `isLoss`, but the Holding schema doesn't define it, so Mongoose drops it.
- **Auth gaps:** no rate limiting on login, no email verification or password reset, tokens can't be revoked early.
- **No frontend tests or CI.**

---

## 12. Project questions

**Walk me through what happens when a user logs in.**
The dashboard posts email and password to `/api/v1/auth/login`. zod normalizes the email. The controller finds the user and runs `bcrypt.compare` — against a dummy hash if the user doesn't exist, so timing is similar. On success it signs a JWT with the user id as `sub`, sets it as an httpOnly, SameSite=Lax cookie for 7 days, and returns the public user. The dashboard stores the user in context and navigates to where they were going.

**How do you make sure one user can't see another user's data?**
`requireAuth` puts the user id from the verified JWT on `req.userId`, and every query filters by it: `Holding.find({ user: req.userId })`, `applySell(req.userId, …)`. The client never sends a user id. Tests assert the queries are scoped.

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
`applySell` throws `ApiError(400, "Cannot sell 5 ITC — you only hold 1.")`, the error handler returns it, and no order is logged because the order is created only after the holding update succeeds.

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

**What would you change to deploy this?**
Frontend on Vercel, API on Render. Ideally proxy `/api` through the frontend's domain so the cookie stays first-party (Lax works). Otherwise set `SameSite=None; Secure` and add CSRF tokens. Set `JWT_SECRET`, `MONGO_URL`, `CLIENT_ORIGINS`, `NODE_ENV=production`.

**Why MongoDB for a trading app?**
Honest answer: it was quick to model and iterate on. For real money I'd prefer PostgreSQL — ACID transactions across holdings and orders, numeric types instead of floats, constraints like `qty >= 0`.

**What's the biggest weakness?**
The client chooses the fill price and there's no balance check — fine for a demo, unacceptable for a real broker. I'd fill at the server-side market price and debit a balance inside a transaction.

**How did you test it?**
28 Jest + supertest tests with mocked models: auth flows, cookie flags, the auth guard on every route, per-user query scoping, buy/sell rules, and validation. Plus manual end-to-end checks against a real database.

**Why are prices stored as strings like "+0.58%"?**
`net` and `day` are display strings carried over from the original UI. Better: store numbers and format in the frontend.

**What did you refactor, and why?**
The backend started as one `index.js` with inline routes and no error handling. I split it into `app.js`/`server.js` and route/controller/service/model layers, added zod validation, `ApiError` + a central error handler, and tests. I also moved the API to versioned REST paths (`/api/v1/holdings` instead of `/allHoldings`).

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
- Tests: **28** (10 auth, 18 orders/data), no DB needed.
- Demo login: `demo@vertextrade.dev` / `demo1234` (created by `npm run seed`, which wipes the DB).
- API base: `/api/v1`; health check at `/health`.
- One command: `npm run dev` at the root starts all three apps.
