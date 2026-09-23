# VertexTrade

A full-stack stock trading platform: a public marketing site, a live trading
dashboard, and a REST API, built with React, Express, and MongoDB.

VertexTrade demonstrates an end-to-end trading product — order placement,
real-time-feeling price updates, portfolio tracking, and a public-facing
marketing site — implemented as three independently deployable applications
sharing a common data layer.

## Architecture

```
                              VertexTrade
                                   │
                ┌──────────────────┼──────────────────┐
                │                  │                  │
                ▼                  ▼                  ▼
           frontend            dashboard            backend
        (marketing site)    (trading dashboard)    (REST API)
         React + Vite         React + Vite        Express + Mongoose
          :5173                 :5174                 :3002
                │                  │                  │
                └──── "Login" ─────┘                  │
                                   └──── HTTP ─────────┘
```

- **frontend/** — the public marketing site (home, products, pricing, about,
  support, signup). Static, Bootstrap-styled pages. Links to the dashboard
  via a "Login" button.
- **dashboard/** — the trading UI: watchlist, buy/sell order flow, holdings,
  positions, orders, and a portfolio summary, all backed by the API.
- **backend/** — Express REST API backed by MongoDB (via Mongoose) for
  holdings, positions, and orders.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend / Dashboard | React, Vite, Bootstrap |
| Backend | Node.js, Express |
| Database | MongoDB, Mongoose |
| Tooling | ESLint / oxlint |

## Features

- Full **buy and sell** order flow through a shared order modal with
  client-side quantity/price validation, and server-side validation plus
  cost-basis logic: a **buy** opens a new holding or averages into an
  existing one (quantity-weighted average cost), and a **sell** reduces
  the held quantity — or is rejected with a 400 if it would sell more
  than is actually held — closing the position removes the holding
- **Holdings, Positions, and Orders** are all real, MongoDB-backed data
  fetched live from the API — not hardcoded or static
- A backend **price simulator** nudges every holding/position price by a
  small random amount (0.05%–0.4%) on a 4-second tick, recomputing `net`
  against average cost each time; the dashboard polls for updates on a
  5-second interval across all four data views (Holdings, Positions,
  Orders, Summary), so rows flash green/red like a live market feed
- **Portfolio summary** (investment, current value, P&L) computed live from
  real holdings data
- Watchlist with live search filtering

## API

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/allHoldings` | — | All Holdings documents |
| GET | `/allPositions` | — | All Positions documents |
| GET | `/allOrders` | — | All Orders, newest first |
| POST | `/newOrder` | `{ name, qty, price, mode }` | `mode` is `"BUY"` or `"SELL"`. Validated server-side (non-empty name, positive integer qty, positive finite price, valid mode) in addition to the dashboard's client-side checks. A `BUY` opens/averages into a Holdings document; a `SELL` reduces it and returns `400` if it exceeds the held quantity |

## Data models

**Holdings** — `{ name, qty, avg, price, net, day }` — one document per symbol currently held; `avg` is the quantity-weighted cost basis, `price` is the simulated last-traded price, `net` is `(price - avg) / avg` as a percentage.

**Positions** — `{ product, name, qty, avg, price, net, day, isLoss }` — seeded independently of Holdings; nudged by the same price simulator.

**Orders** — `{ name, qty, price, mode, timestamps }` — an immutable log of every accepted order.

## Setup

Each app has its own `package.json` and is run independently.

1. **Backend**
   ```
   cd backend
   cp .env.example .env      # then set MONGO_URL to your MongoDB connection string
   npm install
   npm run seed               # one-time: populates sample holdings & positions
   npm start                  # runs on :3002
   ```

2. **Dashboard**
   ```
   cd dashboard
   npm install
   npm run dev                 # runs on :5174
   ```

3. **Frontend**
   ```
   cd frontend
   npm install
   npm run dev                 # runs on :5173
   ```

Open `http://localhost:5173` for the marketing site, or go straight to
`http://localhost:5174` for the dashboard.

### Environment variables

Each app reads its own `.env` (Vite apps use `VITE_`-prefixed vars):

| App        | Variable              | Default                  | Purpose                          |
|------------|------------------------|---------------------------|-----------------------------------|
| frontend   | `VITE_DASHBOARD_URL`   | `http://localhost:5174`   | Where the "Login" button points   |
| dashboard  | `VITE_API_URL`         | `http://localhost:3002`   | Backend base URL                  |
| dashboard  | `VITE_MARKETING_URL`   | `http://localhost:5173`   | "Back to VertexTrade" link        |
| backend    | `MONGO_URL`            | *(required)*               | MongoDB connection string         |
| backend    | `PORT`                 | `3002`                     | API port                          |

## Roadmap

- **Authentication** — currently a single-user demo; all sessions see the
  same data.
- **Funds & Margin** — the Funds and Apps pages are illustrative; there is
  no funds/margin backend yet.
- **Live market data** — the watchlist is currently frontend-only sample
  data; only Holdings, Positions, and Orders are backend-driven.

## Disclaimer

VertexTrade is an independent demo/portfolio project and is not a real
trading platform. It is not affiliated with, endorsed by, or associated with
any real broker — no real money, real orders, or real market data are
involved.
