import mongoose, { Schema } from "mongoose";

const holdingSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  name: String,
  // Shares owned, including any reserved for pending sell orders.
  qty: Number,
  // Shares promised to pending limit sells. Only qty - reservedQty can be sold.
  reservedQty: { type: Number, default: 0, min: 0 },
  avg: Number,
  price: Number,
  net: String,
  day: String,
  isLoss: Boolean,
});

// One holding per user per symbol. Also serves every "this user's holdings"
// query, since user is the leading field.
holdingSchema.index({ user: 1, name: 1 }, { unique: true });

const Holding = mongoose.model("Holding", holdingSchema);

export { Holding };
