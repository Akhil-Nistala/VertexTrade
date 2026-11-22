import mongoose, { Schema } from "mongoose";

export const STARTING_CASH = 100000;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Only the bcrypt hash is ever stored — never the plain password.
    passwordHash: { type: String, required: true },
    // Spendable balance in rupees. Debited on buys, credited on sells.
    cash: { type: Number, default: STARTING_CASH, min: 0 },
    // Rupees set aside for pending limit buys — moved out of `cash` when the
    // order is placed, and back (or spent) when it's cancelled (or filled).
    reservedCash: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export { User };
