require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { HoldingsModel } = require("./model/HoldingsModel");
const { PositionsModel } = require("./model/PositionsModel");
const { OrdersModel } = require("./model/OrdersModel");
const { startPriceSimulator } = require("./priceSimulator");
const { applyBuy, applySell } = require("./services/holdingsService");
const { requireAuth } = require("./middleware/requireAuth");
const authRoutes = require("./routes/auth");

const PORT = process.env.PORT || 3002;
const uri = process.env.MONGO_URL;

// Only these origins may call the API with the user's cookie attached.
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGINS || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim());

const app = express();

app.use(cors({ origin: CLIENT_ORIGINS, credentials: true }));
app.use(bodyParser.json());
app.use(cookieParser());

app.use("/auth", authRoutes);

// Everything below requires a logged-in user, and every query is filtered
// by req.userId so one user can never see or change another's data.
app.get("/allHoldings", requireAuth, async (req, res) => {
  let allHoldings = await HoldingsModel.find({ user: req.userId });
  res.json(allHoldings);
});

app.get("/allPositions", requireAuth, async (req, res) => {
  let allPositions = await PositionsModel.find({ user: req.userId });
  res.json(allPositions);
});

app.get("/allOrders", requireAuth, async (req, res) => {
  let allOrders = await OrdersModel.find({ user: req.userId }).sort({ _id: -1 });
  res.json(allOrders);
});

app.post("/newOrder", requireAuth, async (req, res) => {
  const { name, qty, price, mode } = req.body;

  const isValidName = typeof name === "string" && name.trim().length > 0;
  const isValidQty = typeof qty === "number" && Number.isInteger(qty) && qty > 0;
  const isValidPrice = typeof price === "number" && Number.isFinite(price) && price > 0;
  const isValidMode = mode === "BUY" || mode === "SELL";

  if (!isValidName || !isValidQty || !isValidPrice || !isValidMode) {
    return res.status(400).json({
      message:
        "Invalid order: name must be a non-empty string, qty a positive integer, price a positive number, and mode either BUY or SELL.",
    });
  }

  const trimmedName = name.trim();

  try {
    if (mode === "BUY") {
      await applyBuy(req.userId, trimmedName, qty, price);
    } else {
      await applySell(req.userId, trimmedName, qty);
    }
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }

  const newOrder = new OrdersModel({ user: req.userId, name: trimmedName, qty, price, mode });
  await newOrder.save();

  res.json({ message: "Order saved!" });
});

async function start() {
  if (!uri) {
    console.error(
      "Could not start: MONGO_URL is not set. Copy .env.example to .env and fill in MONGO_URL."
    );
    process.exit(1);
  }

  if (!process.env.JWT_SECRET) {
    console.error(
      "Could not start: JWT_SECRET is not set. Add a long random string to .env (see .env.example)."
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log("DB connected!");
  } catch (err) {
    console.error("Could not connect to MongoDB — check MONGO_URL in .env");
    console.error(err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`App started on port ${PORT}!`);
  });

  startPriceSimulator({ HoldingsModel, PositionsModel });
}

start();
