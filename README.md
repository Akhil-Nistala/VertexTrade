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
  client-side quantity/price validation
- **Holdings, Positions, and Orders** are all real, MongoDB-backed data
  fetched live from the API — not hardcoded or static
- A backend **price simulator** nudges holding/position prices by a small
  random amount every few seconds; the dashboard polls for updates, so rows
  flash green/red like a live market feed
- **Portfolio summary** (investment, current value, P&L) computed live from
  real holdings data
- Watchlist with live search filtering

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
