import { Holding } from "../models/holding.model.js";
import { Position } from "../models/position.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getHoldings = asyncHandler(async (req, res) => {
  const holdings = await Holding.find({ user: req.userId });
  res.status(200).json(holdings);
});

const getPositions = asyncHandler(async (req, res) => {
  const positions = await Position.find({ user: req.userId });
  res.status(200).json(positions);
});

export { getHoldings, getPositions };
