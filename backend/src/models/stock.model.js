import mongoose, { Schema } from "mongoose";

// One document per tradable symbol — the single source of truth for market
// prices. Orders fill at `price`; `open` is the price when the market (the
// server) started, so day change = (price - open) / open.
const stockSchema = new Schema({
  symbol: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  open: { type: Number, required: true },
});

const Stock = mongoose.model("Stock", stockSchema);

export { Stock };
