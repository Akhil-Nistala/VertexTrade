# VertexTrade

A full-stack stock trading platform: a public marketing site, an
authenticated trading dashboard, and a REST API, built with React, Express,
and MongoDB.

Users sign up, get a starter portfolio, and buy and sell stocks against it
while a price simulator keeps the market moving. Each user's holdings,
positions, and orders are private to their account.

## Architecture

```
   frontend (marketing site)         dashboard (trading app)          backend (REST API)
   React + Vite + Bootstrap          React + Vite + MUI               Express + Mongoose
   :5173                             :5174                            :3002
          │                                 │                                 │
          │  Login / Signup links  ───────▶ │                                 │
          │                                 │  HTTP + httpOnly JWT cookie ──▶ │ ──▶ MongoDB
          │                                 │  (polls every 5s)               │
          │                                 │                                 │ price simulator
          │                                 │                                 │ (ticks every 4s)
```

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
- The API issues a signed **JWT (7-day expiry) in an httpOnly, SameSite=Lax
  cookie**, so page JavaScript never sees the token.
- Every data route runs `requireAuth`, and every query is filtered by the
  user id **from the token** — never from client input — so users can only
  see and trade against their own portfolio.
- Login returns the same error for an unknown email and a wrong password,
  and compares against a dummy hash when the email doesn't exist, so
  neither the message nor the timing reveals which emails are registered.
- The dashboard confirms the session with `/auth/me` on load, guards pages
  with a `withAuth` wrapper, and returns to the login page if any request
  comes back `401`.
- New accounts start with a sample portfolio so the dashboard isn't empty.

### Trading
- **Buy and sell** through a shared order window, validated on the client
  and again on the server (zod).
- A **buy** opens a new holding or averages into an existing one
  (quantity-weighted average cost). A **sell** reduces the quantity, removes
  the holding when it reaches zero, and is rejected with `400` if it exceeds
  what's held — rejected orders are never logged.
- Every accepted order is recorded in the user's order history.

### Live portfolio
- A backend **price simulator** moves every holding and position price by
  0.05%–0.4% every 4 seconds and recomputes net change against cost.
- The dashboard polls every 5 seconds; changed rows flash green or red.
- **Portfolio summary** — investment, current value, and P&L — computed from
  live holdings.
- Watchlist with search filtering.

### Backend quality
- `app.js` / `server.js` split, so the app can be tested without a database
  or open port.
- Central error handling: errors thrown anywhere — including inside async
  handlers — return `{ success: false, message }`; unexpected errors are
  logged and returned as a generic `500`.
- Locked-down CORS (configured origins only, with credentials) and a
  `/health` endpoint.
- **28 API tests** (Jest + supertest) covering signup, login, sessions, the
  auth guard, per-user data scoping, validation, and buy/sell rules.

## API

All routes except `/health` and signup/login/logout require the auth cookie
and return `401` without it. Errors are returned as
`{ success: false, message }`, with per-field `errors` for validation
failures.

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/auth/signup` | `{ name, email, password }` | Password ≥ 8 characters. Creates the user and their starter portfolio, sets the auth cookie. `409` if the email is taken |
| POST | `/auth/login` | `{ email, password }` | Sets the auth cookie. `401` with a generic message on bad credentials |
| POST | `/auth/logout` | — | Clears the auth cookie |
| GET | `/auth/me` | — | The logged-in user |
| GET | `/health` | — | Liveness check |
| GET | `/allHoldings` | — | The user's holdings |
| GET | `/allPositions` | — | The user's positions |
| GET | `/allOrders` | — | The user's orders, newest first |
| POST | `/newOrder` | `{ name, qty, price, mode }` | `qty` a positive integer, `price` a positive number, `mode` `"BUY"` or `"SELL"`. `400` on invalid input or when selling more than is held |

## Data models

Holdings, Positions, and Orders each carry a required, indexed `user`
reference.

| Model | Fields | Notes |
|---|---|---|
| **User** | `name, email, passwordHash, timestamps` | `email` is unique and lowercased |
| **Holding** | `user, name, qty, avg, price, net, day` | One per symbol held. `avg` is the cost basis, `price` the simulated last price, `net` = `(price − avg) / avg` |
| **Position** | `user, product, name, qty, avg, price, net, day, isLoss` | Part of the starter portfolio; moved by the same simulator |
| **Order** | `user, name, qty, price, mode, timestamps` | Log of every accepted order |

## Project structure

### Backend

`app.js` builds the Express app (middleware, routes, error handling) and
exports it without connecting to anything; `server.js` connects to MongoDB,
starts listening, and starts the price simulator. Tests import `app.js`
directly.

```
backend/
├── src/
│   ├── app.js                  # Express app: CORS, cookies, routes, error handler
│   ├── server.js               # Entry point: connect DB, listen, start simulator
│   ├── seed.js                 # Resets the DB and creates the demo user
│   ├── config/db.js            # MongoDB connection
│   ├── routes/                 # auth, portfolio, order routers
│   ├── controllers/            # Request handlers
│   ├── middleware/             # requireAuth, zod validation, 404 + error handler
│   ├── validators/             # zod schemas for auth and orders
│   ├── models/                 # user, holding, position, order
│   ├── services/               # buy/sell cost-basis logic, price simulator
│   ├── utils/                  # ApiError, asyncHandler, JWT cookie helpers
│   └── data/samplePortfolio.js # Starter portfolio for new accounts
└── tests/                      # Jest + supertest, models mocked (no DB needed)
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
├── hooks/                  # usePolling, usePriceFlash
├── styles/                 # Stylesheets
└── data/                   # Sample watchlist

frontend/src/
├── App.jsx                 # Routes for the marketing pages
├── pages/                  # Home, Products, Pricing, About, Support, Signup, NotFound
└── components/             # Navbar, Footer, Logo, OpenAccount, plus per-page sections
                            #   in home/, products/, pricing/, about/, support/
```

## Getting started

**Prerequisites:** Node.js 18+ and a MongoDB instance (local or Atlas).

1. **Backend**
   ```
   cd backend
   cp .env.example .env      # set MONGO_URL and JWT_SECRET
   npm install
   npm run seed              # optional — WIPES the database and creates the demo user
   npm run dev               # :3002, auto-reloads (npm start runs without)
   ```

2. **Dashboard**
   ```
   cd dashboard
   npm install
   npm run dev               # :5174
   ```

3. **Marketing site**
   ```
   cd frontend
   npm install
   npm run dev               # :5173
   ```

Open `http://localhost:5174` and sign up, or log in with the demo account
created by the seed script:

```
Email:    demo@vertextrade.dev
Password: demo1234
```

### Tests

```
cd backend
npm test                    # no database required
```

### Environment variables

Each app has a `.env.example`. The Vite apps work with their defaults locally.

| App | Variable | Default | Purpose |
|---|---|---|---|
| backend | `MONGO_URL` | *(required)* | MongoDB connection string |
| backend | `JWT_SECRET` | *(required)* | Secret for signing login tokens — use a long random string |
| backend | `PORT` | `3002` | API port |
| backend | `CLIENT_ORIGINS` | `http://localhost:5173,http://localhost:5174` | Origins allowed to call the API with cookies |
| dashboard | `VITE_API_URL` | `http://localhost:3002` | Backend URL |
| dashboard | `VITE_MARKETING_URL` | `http://localhost:5173` | Marketing site, linked from the logo |
| frontend | `VITE_DASHBOARD_URL` | `http://localhost:5174` | Where Login and Signup point |

## Known limitations and roadmap

- **Shared market prices** — the simulator moves each user's copy of a stock
  independently, so two users holding the same symbol see different prices.
  A real system would keep one price table that holdings reference.
- **Auth hardening** — rate limiting on login, email verification, password
  reset, and refresh-token rotation. Deployed on separate domains, the
  cookie would need `SameSite=None; Secure` plus CSRF protection.
- **Funds & margin** — the Funds and Apps pages are illustrative; there is
  no balance check on buys yet.
- **Market data** — the watchlist is frontend sample data; only holdings,
  positions, and orders come from the backend.
- **Frontend tests and CI** — the API is tested; the React apps are not yet.

## Disclaimer

VertexTrade is an independent demo/portfolio project, not a real trading
platform. It is not affiliated with any broker, and no real money, orders,
or market data are involved.
