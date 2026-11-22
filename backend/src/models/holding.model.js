import mongoose, { Schema } from "mongoose";

const holdingSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: String,
  qty: Number,
  avg: Number,
  price: Number,
  net: String,
  day: String,
  isLoss: Boolean,
});

const Holding = mongoose.model("Holding", holdingSchema);

export { Holding };
