import { getFunds as readFunds } from "../services/funds.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getFunds = asyncHandler(async (req, res) => {
  res.status(200).json(await readFunds(req.userId));
});

export { getFunds };
