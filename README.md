# VertexTrade

A full-stack stock trading platform: a public marketing site, an
authenticated trading dashboard, and a REST API, built with React, Express,
and MongoDB.

Users sign up, get ₹1,00,000 of virtual cash and a starter portfolio, and
place market and limit orders that the server fills at live simulated
prices. Each
user's cash, holdings, positions, and orders are private to their account.

## Architecture

```
   frontend (marketing site)         dashboard (trading app)          backend (REST API)
   React + Vite + Bootstrap          React + Vite + MUI               Express + Mongoose
   :5173                             :5174                            :3002
          │                                 │                                 │
          │  Login / Signup links  ───────▶ │                                 │
          │                                 │  HTTP + httpOnly JWT cookie ──▶ │ ──▶ MongoDB
          │                                 │  (polls every 5s)               │     users, stocks, holdings,
          │                                 │                                 │     positions, orders
          │                                 │                                 │
          │                                 │                                 │ price simulator
          │                                 │                                 │ (moves stocks every 4s)
```

In production the dashboard reaches the API through a Vercel proxy on its
own domain — see [Deployment](#deployment).

- **frontend/** — static marketing pages (home, products, pricing, about,
  support). Login and Signup hand off to the dashboard.
- **dashboard/** — login/signup, watchlist, buy/sell order window, holdings,
  positions, orders, and a portfolio summary — all behind authentication
  and backed by the API.
- **backend/** — Express API over MongoDB: authentication, per-user
  portfolio data, order placement, and a background price simulator.

The three apps are independently runnable and deployable.

## Tech stack

| Layer | Technology |
|---|---|
| Marketing site | React, Vite, React Router, Bootstrap |
| Dashboard | React, Vite, React Router, MUI, Chart.js, axios |
| Backend | Node.js, Express (ES modules) |
| Database | MongoDB, Mongoose |
| Auth | bcryptjs, jsonwebtoken, httpOnly cookies |
| Validation | zod |
| Testing | Jest, supertest |
| Linting | ESLint (frontend), oxlint (dashboard) |

## Features

### Authentication
- Email/password signup and login. Passwords are hashed with **bcrypt**;
  only the hash is stored.
- The API issues a signed **JWT (7-day expiry) in an httpOnly cookie**, so
  page JavaScript never sees the token. The cookie is `SameSite=Lax` locally
  and behind the production proxy, and `Secure` (HTTPS-only) in production.
- Every data route runs `requireAuth`, and every query is filtered by the
  user id **from the token** — never from client input — so users can only
  see and trade against their own portfolio.
- Login returns the same error for an unknown email and a wrong password,
  and compares against a dummy hash when the email doesn't exist, so
  neither the message nor the timing reveals which emails are registered.
- The dashboard confirms the session with `/auth/me` on load, guards pages
  with a `withAuth` wrapper, and returns to the login page if any request
  comes back `401`.
- New accounts start with **₹1,00,000 of virtual cash** and a sample
  portfolio, so the dashboard isn't empty.

### How authentication works

1. **Signup / login** — the request body is validated with zod (email
   trimmed and lowercased, password ≥ 8 characters on signup). Signup stores
   `bcrypt.hash(password, 10)`; login runs `bcrypt.compare`.
2. **Token** — on success the API signs a JWT with `JWT_SECRET` (HS256)
   whose payload is just `{ sub: userId }`, expiring in 7 days. The payload
   is signed, not encrypted, so it holds no secrets.
3. **Cookie** — the token is set as the `token` cookie: `httpOnly`,
   `SameSite` from `COOKIE_SAMESITE` (`lax` locally), `Secure` in
   production, 7-day `maxAge`. The dashboard's axios client uses
   `withCredentials`, so the browser sends it automatically.
4. **Every request** — `requireAuth` reads the cookie, runs `jwt.verify`
   (signature + expiry), and sets `req.userId`. Missing → `401 Not logged
   in`; invalid or expired → `401 Session expired`. Controllers only ever
   query with `req.userId`.
5. **Session restore** — the page can't read an httpOnly cookie, so on load
   the dashboard calls `GET /api/v1/auth/me`. `withAuth` shows a loading
   state until it answers, then renders the page or redirects to `/login`
   (remembering where the user was going).
6. **Expiry and logout** — an axios interceptor treats any `401` as logged
   out. `POST /api/v1/auth/logout` clears the cookie with the same options
   it was set with.

### Trading
- **Market orders** fill immediately at the server's current price. The
  client never sends a fill price; one it does send is ignored.
- **Limit orders** fill only at the limit price or better (at or below it
  for a buy, at or above it for a sell). One the market already satisfies
  fills immediately at the market price; otherwise it waits as `PENDING`
  and the matcher fills it on the first price tick that reaches the limit.
  Pending orders can be cancelled, and they expire when the market reopens
  (when the server restarts).
- **Reserved funds.** A pending buy moves `qty × limit` from `cash` into
  `reservedCash`; a pending sell marks the shares as `reservedQty`. Market
  orders can only use what isn't reserved, so you can't place two orders
  against the same money or shares. On a fill below the limit, the unused
  part of the reserve goes back to cash; cancelling or expiring releases it.
- **Transactions.** Placing, filling, cancelling, and expiring each run in
  one MongoDB transaction, so the order, the cash, and the holding change
  together or not at all.
- **Race-safe by construction.** Inside the transaction, every balance
  change is a conditional update (`cash >= cost`, `available shares >=
  qty`), and every order is closed with a conditional update on
  `status: PENDING`. Two buys can't spend the same cash, and a fill racing a
  cancel resolves to exactly one of them.
- A **buy** opens a new holding or averages into an existing one
  (quantity-weighted average cost); a **sell** removes the holding when it
  reaches zero. Rejected orders (unknown symbol, insufficient funds, not
  enough available shares) are never logged.

### Live market
- **One shared price per stock.** A `Stock` collection holds the market;
  every 4 seconds the simulator moves each price by 0.05%–0.4%, copies it
  onto every holding and position (so all users see the same prices), and
  then runs the limit-order matcher.
- Day change is measured from the open price, set when the server starts.
- The dashboard polls every 5 seconds; changed prices flash green or red.
- **Live watchlist** with search, served from the API — the same prices
  orders fill at.
- **Orders page** with Open (pending, cancellable) and History tabs.
- **Summary and Funds** show available and reserved cash, invested amount,
  holdings value, and P&L; Holdings shows reserved shares.

### Backend quality
- `app.js` / `server.js` split, so the app can be tested without a database
  or open port.
- Central error handling: errors thrown anywhere — including inside async
  handlers — return `{ success: false, message }`; unexpected errors are
  logged and returned as a generic `500`.
- Locked-down CORS (configured origins only, with credentials), 40kb
  request body limits, and a `/health` endpoint.
- **63 unit tests** (Jest + supertest, models mocked) covering auth, cookie
  settings, the auth guard, per-user scoping, validation, and every trading
  path — asserting the exact conditional updates and that each write runs
  inside the transaction.
- **11 integration tests** against a real replica set proving what mocks
  can't: concurrent buys and sells can't overspend or oversell, an order
  fills exactly once even when settled twice at once or raced by a cancel,
  and a failure mid-order rolls back every write.

## API

Resource-oriented and versioned under `/api/v1`. All routes except
`/health` and signup/login/logout require the auth cookie and return `401`
without it. Errors are returned as `{ success: false, message }`, with
per-field `errors` for validation failures.

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/health` | — | Liveness check |
| POST | `/api/v1/auth/signup` | `{ name, email, password }` | Password ≥ 8 characters. Creates the user and their starter portfolio, sets the auth cookie. `201`; `409` if the email is taken |
| POST | `/api/v1/auth/login` | `{ email, password }` | Sets the auth cookie. `401` with a generic message on bad credentials |
| POST | `/api/v1/auth/logout` | — | Clears the auth cookie |
| GET | `/api/v1/auth/me` | — | The logged-in user |
| GET | `/api/v1/holdings` | — | The user's holdings |
| GET | `/api/v1/positions` | — | The user's positions |
| GET | `/api/v1/orders?status=` | — | The user's orders, newest first. Optional `status`: `PENDING`, `FILLED`, `CANCELLED`, `EXPIRED` |
| POST | `/api/v1/orders` | `{ name, qty, mode, type?, limitPrice? }` | `type` is `MARKET` (default) or `LIMIT`; `limitPrice` (≤ 2 decimals) is required for `LIMIT` and rejected for `MARKET`. `201` with `{ order, funds }` — the order is `FILLED`, or `PENDING` for a resting limit order. `400` on invalid input, unknown symbol, insufficient funds, or not enough available shares |
| POST | `/api/v1/orders/:id/cancel` | — | Cancels a pending order and releases its reserve. `200` with `{ order, funds }`; `404` if it isn't yours; `409` if it's no longer pending |
| GET | `/api/v1/stocks` | — | Market quotes: `{ symbol, price, day, isDown }` |
| GET | `/api/v1/funds` | — | The user's balances: `{ cash, reservedCash }` |

## Data models

Holdings, Positions, and Orders each carry a required, indexed `user`
reference.

| Model | Fields | Notes |
|---|---|---|
| **User** | `name, email, passwordHash, cash, reservedCash, timestamps` | `email` is unique and lowercased; `cash` starts at ₹1,00,000; `reservedCash` is held for pending limit buys |
| **Stock** | `symbol, price, open` | The market: one document per tradable symbol. Orders fill at `price`; day change is measured from `open` |
| **Holding** | `user, name, qty, reservedQty, avg, price, net, day, isLoss` | Unique per `{ user, name }`. `qty` includes `reservedQty` (shares held for pending limit sells). `avg` is the cost basis, `price` copied from the Stock, `net` = `(price − avg) / avg` |
| **Position** | `user, product, name, qty, avg, price, net, day, isLoss` | Part of the starter portfolio; moved by the same simulator |
| **Order** | `user, name, qty, mode, type, status, limitPrice, reserved, price, closedAt, timestamps` | `status`: `PENDING → FILLED / CANCELLED / EXPIRED` (market orders are created `FILLED`). `reserved` is the cash or shares held while pending; `price` is the actual fill price. Indexed on `{ status, name }` for the matcher |

## Project structure

```
VertexTrade/
├── package.json        # root scripts: dev (all apps), install:all, test, seed
├── render.yaml         # Render blueprint for the API
├── INTERVIEW_PREP.md   # walkthrough of every file, flow, and design decision
├── LICENSE
├── backend/            # Express API
├── dashboard/          # trading app (+ vercel.json: /api proxy)
└── frontend/           # marketing site (+ vercel.json)
```

### Backend

`app.js` builds the Express app (middleware, routes, error handling) and
exports it without connecting to anything; `server.js` checks `JWT_SECRET`,
connects to MongoDB (and checks it supports transactions), opens the
market, expires the previous session's pending orders, starts listening,
and starts the price simulator. Tests import `app.js` directly.

```
backend/
├── src/
│   ├── app.js                  # Express app: CORS, cookies, routes, error handler
│   ├── server.js               # Entry point: connect DB, open market, expire stale orders, listen, simulate
│   ├── seed.js                 # Resets the DB and creates the demo user
│   ├── config/db.js            # MongoDB connection + replica-set check
│   ├── routes/                 # auth, holding, position, order, stock, funds routers
│   ├── controllers/            # Request handlers
│   ├── middleware/             # requireAuth, zod validation, 404 + error handler
│   ├── validators/             # zod schemas for auth and orders
│   ├── models/                 # user, stock, holding, position, order
│   ├── services/               # trading (place/settle/cancel), matching, funds, price simulator
│   ├── utils/                  # ApiError, asyncHandler, JWT cookie helpers, money, transaction
│   └── data/                   # market.js (stock universe), samplePortfolio.js
└── tests/                      # unit tests (models mocked) + integration/ (real replica set)
```

### Frontends

Both React apps use the same layout: route-level screens in `pages/`,
reusable pieces in `components/`.

```
dashboard/src/
├── App.jsx                 # Routes: /login, /signup, everything else behind withAuth
├── pages/                  # Authentication, Home, Summary, Orders, Holdings, Positions, Funds, Apps
├── components/             # TopBar, Menu, WatchList, OrderActionWindow, charts, Logo
├── context/                # AuthContext (current user), GeneralContext (order window)
├── config/api.js           # axios instance (sends the auth cookie)
├── utils/withAuth.jsx      # Renders a page only once /auth/me confirms the session
├── hooks/                  # usePolling, usePriceFlash, useFunds
└── styles/                 # Stylesheets

frontend/src/
├── App.jsx                 # Routes for the marketing pages
├── pages/                  # Home, Products, Pricing, About, Support, Signup, NotFound
└── components/             # Navbar, Footer, Logo, OpenAccount, plus per-page sections
                            #   in home/, products/, pricing/, about/, support/
```

## Getting started

**Prerequisites:** Node.js 18+ and MongoDB running as a **replica set** —
orders use transactions, which a standalone `mongod` doesn't support. Atlas
is always a replica set. For a local MongoDB, a single-node replica set is
enough:

- **Windows service:** in `mongod.cfg` (e.g.
  `C:\Program Files\MongoDB\Server\8.2\bin\mongod.cfg`), replace
  `#replication:` with `replication:` and `  replSetName: rs0`, then run
  `Restart-Service MongoDB` in an Administrator PowerShell.
- **macOS / Linux:** start `mongod` with `--replSet rs0` (or add the same
  `replication` block to its config).
- **Then, once:** `mongosh --eval 'rs.initiate()'`.

The server refuses to start against a standalone MongoDB and says why.

```
cp backend/.env.example backend/.env   # set MONGO_URL and JWT_SECRET (see below)
npm run install:all                    # installs root + all three apps
npm run seed                           # optional — WIPES the database and creates the demo user
npm run dev                            # starts backend :3002, dashboard :5174, frontend :5173
```

Generate a `JWT_SECRET` with:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Each app can also be run on its own with `npm run dev` inside its folder
(the backend also has `npm start`, without auto-reload).

Open `http://localhost:5174` and sign up, or log in with the demo account
created by the seed script:

```
Email:    demo@vertextrade.dev
Password: demo1234
```

### Tests

```
npm test                    # unit tests — no database required
npm run test:integration    # needs a replica set; uses vertextrade_test (wiped each test)
```

The integration tests read `TEST_MONGO_URL` (default
`mongodb://127.0.0.1:27017/vertextrade_test`) and refuse to run against a
database whose name doesn't end in `_test`.

### Environment variables

Each app has a `.env.example`. The Vite apps work with their defaults locally.

| App | Variable | Default | Purpose |
|---|---|---|---|
| backend | `MONGO_URL` | *(required)* | MongoDB connection string |
| backend | `JWT_SECRET` | *(required)* | Secret for signing login tokens — use a long random string |
| backend | `PORT` | `3002` | API port |
| backend | `CLIENT_ORIGINS` | `http://localhost:5173,http://localhost:5174` | Origins allowed to call the API with cookies |
| backend | `NODE_ENV` | — | `production` makes the auth cookie `Secure` |
| backend | `COOKIE_SAMESITE` | `lax` (dev) / `none` (production) | Set to `lax` when the frontend proxies `/api` (as on Vercel) |
| dashboard | `VITE_API_URL` | `http://localhost:3002` (dev) / same origin (production) | Backend URL; leave unset in production to use the Vercel proxy |
| dashboard | `VITE_MARKETING_URL` | `http://localhost:5173` | Marketing site, linked from the logo |
| frontend | `VITE_DASHBOARD_URL` | `http://localhost:5174` | Where Login and Signup point |

## Deployment

The backend runs on **Render** and both React apps on **Vercel**. The
dashboard calls `/api/...` on its own domain and Vercel proxies it to Render,
so the auth cookie is first-party and works with `SameSite=Lax` even in
browsers that block third-party cookies.

```
browser ──▶ dashboard.vercel.app/api/v1/... ──(Vercel rewrite)──▶ vertextrade-api.onrender.com/api/v1/...
```

1. **Database** — create a free MongoDB Atlas cluster and copy its
   connection string. Allow access from Render (Network Access →
   `0.0.0.0/0` is simplest for a demo).
2. **Backend (Render)** — New → Blueprint → select this repo. Render reads
   [`render.yaml`](render.yaml): it builds `backend/`, generates
   `JWT_SECRET`, sets `NODE_ENV=production` and `COOKIE_SAMESITE=lax`, and
   health-checks `/health`. Fill in:
   - `MONGO_URL` — the Atlas connection string
   - `CLIENT_ORIGINS` — your two Vercel URLs, comma-separated
3. **Dashboard (Vercel)** — New Project → this repo, root directory
   `dashboard`. If your Render URL isn't `vertextrade-api.onrender.com`,
   update the destination in [`dashboard/vercel.json`](dashboard/vercel.json).
   Set `VITE_MARKETING_URL` to the marketing site's URL. Leave
   `VITE_API_URL` unset so requests go through the proxy.
4. **Marketing site (Vercel)** — New Project → this repo, root directory
   `frontend`. Set `VITE_DASHBOARD_URL` to the dashboard's URL.
5. **Demo data (optional)** — the server creates the market on startup;
   sign up for an account, or run `npm run seed` locally with `MONGO_URL`
   pointed at Atlas (this wipes that database).

Render's free plan sleeps after inactivity, so the first request can take
~30 seconds, and the price simulator only runs while the service is awake.

## Known limitations and roadmap

- **Token revocation** — a JWT stays valid until it expires; logout only
  clears the cookie in that browser. Refresh-token rotation or a server-side
  denylist would allow revoking sessions.
- **Auth hardening** — rate limiting on login, email verification, and
  password reset. If the API were called cross-site
  instead of through the proxy, the cookie would need `SameSite=None; Secure`
  plus CSRF protection.
- **Order types** — market and day limit orders only: no stop-loss, no
  good-till-cancelled, no partial fills (any quantity fills at once in the
  simulated market).
- **Single matcher** — matching runs inside the API process. Several
  instances would each run it; the conditional claim keeps fills correct,
  but a real system would run one dedicated matching worker.
- **Money as floats** — cash and prices are rupee floats rounded to paise;
  integer paise would avoid floating-point drift entirely.
- **Simulated market** — prices are random walks, not real market data.
  Adding or withdrawing funds and margin aren't supported.
- **Frontend tests and CI** — the API is tested; the React apps are not yet.

## Disclaimer

VertexTrade is an independent demo/portfolio project, not a real trading
platform. It is not affiliated with any broker, and no real money, orders,
or market data are involved.

## License

[MIT](LICENSE)
