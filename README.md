# VertexTrade

A from-scratch, bug-fixed, restyled rebuild of a Zerodha-style stock trading
platform clone, built for learning full-stack React + Express + MongoDB. It
is **not affiliated with, endorsed by, or a copy of any real broker** — all
branding, copy, and the "team" section are fictional.

VertexTrade started from a well-known open tutorial clone and a half-finished
Vite rewrite of its marketing site, and was rebuilt into three independently
runnable apps with the original bugs fixed and a few small features added on
top.

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
  support, signup). Static Bootstrap-styled pages, no backend calls. Links to
  the dashboard via a "Login" button.
- **dashboard/** — the actual trading UI: watchlist, buy/sell order flow,
  holdings, positions, orders, and a portfolio summary, all talking to the
  backend.
- **backend/** — Express REST API backed by MongoDB (via Mongoose) for
  holdings, positions, and orders.

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

## Features

- Watchlist with live search filtering
- Buy **and** Sell order flow (the original tutorial's Sell button did
  nothing — this rebuild wires both to a shared order modal with client-side
  quantity/price validation)
- Holdings, Positions, and Orders are all real, MongoDB-backed data fetched
  from the API — the original left Positions on static mock data and Orders
  permanently hardcoded to "no orders yet"
- A lightweight backend "price simulator" nudges holding/position prices by
  a small random amount every few seconds, and the dashboard polls for it,
  so rows flash green/red like a live market feed
- Portfolio summary (investment, current value, P&L) computed from real
  holdings data instead of hardcoded numbers

## Known limitations

- **No authentication.** This is a single-user demo — anyone who opens the
  dashboard sees the same data. Don't deploy this as-is for multiple users.
- **Funds and Apps pages are illustrative/mocked.** There's no funds/margin
  backend; those numbers are static placeholders, clearly not wired to
  real data.
- The watchlist itself is frontend-only mock data (matching the original
  scope) — only Holdings/Positions/Orders are backend-driven.
