import mongoose, { Schema } from "mongoose";

const orderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: String,
    qty: Number,
    price: Number,
    mode: { type: String, enum: ["BUY", "SELL"] },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

export { Order };
