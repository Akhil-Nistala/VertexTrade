import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { roundMoney } from "../utils/money.js";

// The user's spendable and reserved cash, rounded to paise.
export const getFunds = async (userId) => {
  const user = await User.findById(userId, { cash: 1, reservedCash: 1 });
  if (!user) {
    throw new ApiError(401, "Account not found.");
  }
  return { cash: roundMoney(user.cash), reservedCash: roundMoney(user.reservedCash ?? 0) };
};
