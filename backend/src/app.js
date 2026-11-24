import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes.js";
import holdingRoutes from "./routes/holding.routes.js";
import positionRoutes from "./routes/position.routes.js";
import orderRoutes from "./routes/order.routes.js";
import stockRoutes from "./routes/stock.routes.js";
import fundsRoutes from "./routes/funds.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

// Builds and exports the Express app without connecting to the database or
// opening a port — server.js does that. Keeping them apart lets tests import
// the app and send it requests directly with supertest.
const app = express();

// Only these origins may call the API with the user's cookie attached.
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGINS || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim());

app.use(cors({ origin: CLIENT_ORIGINS, credentials: true }));
app.use(cookieParser());
// JSON only, no form-encoded bodies: an HTML form on another site can't send
// JSON, and a cross-site fetch with JSON needs a CORS preflight that only
// the allowed origin passes. Part of the CSRF defence, alongside SameSite=Lax.
app.use(express.json({ limit: "40kb" }));

app.get("/health", (req, res) => res.status(200).json({ success: true, status: "ok" }));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/holdings", holdingRoutes);
app.use("/api/v1/positions", positionRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/stocks", stockRoutes);
app.use("/api/v1/funds", fundsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
