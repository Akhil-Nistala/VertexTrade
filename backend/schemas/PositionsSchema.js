const { Schema } = require("mongoose");

const PositionsSchema = new Schema({
  product: String,
  user: { type: Schema.Types.ObjectId, ref: "user", required: true, index: true },
  name: String,
  qty: Number,
  avg: Number,
  price: Number,
  net: String,
  day: String,
  isLoss: Boolean,
});

module.exports = { PositionsSchema };
