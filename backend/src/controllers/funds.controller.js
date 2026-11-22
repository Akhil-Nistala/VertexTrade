import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { roundMoney } from "../utils/money.js";

const getFunds = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId, { cash: 1 });
  if (!user) {
    throw new ApiError(401, "Account not found.");
  }
  res.status(200).json({ cash: roundMoney(user.cash) });
});

export { getFunds };
