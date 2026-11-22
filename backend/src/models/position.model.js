import mongoose, { Schema } from "mongoose";

const positionSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  product: String,
  name: String,
  qty: Number,
  avg: Number,
  price: Number,
  net: String,
  day: String,
  isLoss: Boolean,
});

const Position = mongoose.model("Position", positionSchema);

export { Position };
