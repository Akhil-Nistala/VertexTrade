import { Position } from "../models/position.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getPositions = asyncHandler(async (req, res) => {
  const positions = await Position.find({ user: req.userId });
  res.status(200).json(positions);
});

export { getPositions };
