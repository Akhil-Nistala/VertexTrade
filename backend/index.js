require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");

const { HoldingsModel } = require("./model/HoldingsModel");
const { PositionsModel } = require("./model/PositionsModel");
const { OrdersModel } = require("./model/OrdersModel");
const { startPriceSimulator } = require("./priceSimulator");
const { applyBuy, applySell } = require("./services/holdingsService");

const PORT = process.env.PORT || 3002;
const uri = process.env.MONGO_URL;

const app = express();

app.use(cors());
app.use(bodyParser.json());

app.get("/allHoldings", async (req, res) => {
  let allHoldings = await HoldingsModel.find({});
  res.json(allHoldings);
});

app.get("/allPositions", async (req, res) => {
  let allPositions = await PositionsModel.find({});
  res.json(allPositions);
});

app.get("/allOrders", async (req, res) => {
  let allOrders = await OrdersModel.find({}).sort({ _id: -1 });
  res.json(allOrders);
});

app.post("/newOrder", async (req, res) => {
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
      await applyBuy(trimmedName, qty, price);
    } else {
      await applySell(trimmedName, qty);
    }
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }

  const newOrder = new OrdersModel({ name: trimmedName, qty, price, mode });
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
